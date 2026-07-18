# api/app.py
"""
FastAPI + Motor (async MongoDB) integration for IDS.
Saves flows and alerts, schedules blocking, uses joblib RandomForest model for detection.

Features in this improved version:
- JSON-safe conversion helper for ObjectId and datetimes
- FEATURE_ORDER fallback
- USE_REAL_BLOCKING env toggle to enable actual iptables manipulation (guarded)
- Better logging
"""
import os
import asyncio
from dotenv import load_dotenv

# Load .env file into environment variables (override=True ensures we pick up SSL_CERT_FILE)
load_dotenv(override=True)

# Force SSL_CERT_FILE into environment if present in .env (Python SSL needs it set before any TLS connections)
_ssl_cert = os.getenv("SSL_CERT_FILE")
if _ssl_cert and os.path.isfile(_ssl_cert):
    os.environ["SSL_CERT_FILE"] = _ssl_cert
    os.environ["REQUESTS_CA_BUNDLE"] = _ssl_cert  # for requests library
    import ssl
    ssl._create_default_https_context = ssl._create_unverified_context  # fallback

import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
import subprocess
import logging
from concurrent.futures import ThreadPoolExecutor
from bson import ObjectId
import socket
import shutil

LOG = logging.getLogger("uvicorn.error")
app = FastAPI(title="IDS Model Detector w/ MongoDB")

# Add CORS middleware to allow dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- Configuration ----------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "saved_models", "rf_model.joblib")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("IDS_DB", "idsdb")
DEFAULT_BLOCK_DURATION_SEC = int(os.getenv("BLOCK_DURATION_SEC", "600"))  # 10 minutes default
DEFAULT_THRESHOLD = float(os.getenv("MODEL_THRESHOLD", "0.7"))
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")

# Allow turning on real blocking on capable Linux hosts
USE_REAL_BLOCKING = os.getenv("USE_REAL_BLOCKING", "").lower() in ("1", "true", "yes")

# Default feature order (fallback if no model metadata present)
DEFAULT_FEATURE_ORDER = ["total_packets","total_bytes","duration","pkts_per_sec","bytes_per_sec","syn_count","unique_dst_ports"]
FEATURE_ORDER = DEFAULT_FEATURE_ORDER.copy()
CONFIG_DOC_ID = "detection_policy"
CONFIG_CACHE = {
    "_id": CONFIG_DOC_ID,
    "threshold": DEFAULT_THRESHOLD,
    "block_duration_sec": DEFAULT_BLOCK_DURATION_SEC,
    "blocking_enabled": True,  # Master toggle for IP blocking
    "updated_at": None,
}
# -------------------------------

# Load model (sync) - fail early if missing
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Model not found at {MODEL_PATH}. Train first using models/train.py")

model = joblib.load(MODEL_PATH)

# Thread pool for blocking calls and CPU-bound sync model calls
executor = ThreadPoolExecutor(max_workers=2)

# Motor client will be created on startup
mongo_client: Optional[AsyncIOMotorClient] = None
db = None

# -------- Pydantic model ----------
class FeatureVec(BaseModel):
    src_ip: str
    total_packets: int
    total_bytes: int
    duration: float
    pkts_per_sec: float
    bytes_per_sec: float
    syn_count: int
    unique_dst_ports: int
    extra: Optional[Dict[str,Any]] = None


class ConfigUpdate(BaseModel):
    threshold: Optional[float] = None
    block_duration_sec: Optional[int] = None
    blocking_enabled: Optional[bool] = None


class IPNote(BaseModel):
    ip: str
    note: Optional[str] = None


class ManualBlockRequest(BaseModel):
    ip: str
    duration_sec: Optional[int] = None
    note: Optional[str] = None
# ----------------------------------

# JSON-safe conversion helper
def make_jsonable(doc: Any):
    """Convert BSON types (ObjectId, datetimes) to JSON-serializable types."""
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            out[k] = make_jsonable(v)
        return out
    if isinstance(doc, list):
        return [make_jsonable(x) for x in doc]
    if isinstance(doc, ObjectId):
        return str(doc)
    # datetimes -> ISO format
    try:
        # datetime objects have isoformat
        if hasattr(doc, "isoformat"):
            return doc.isoformat()
    except Exception:
        pass
    return doc


async def require_admin_token(x_admin_token: Optional[str] = Header(default=None)):
    if not ADMIN_API_KEY:
        return True
    if x_admin_token != ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")
    return True

# ---------- DB helper: create indexes ----------
async def create_indexes():
    # flows
    await db.flows.create_index([("ts_start", 1)])
    await db.flows.create_index([("src_ip", 1)])
    # alerts
    await db.alerts.create_index([("detected_at", -1)])
    await db.alerts.create_index([("src_ip", 1)])
    # whitelist unique
    await db.whitelist.create_index("ip", unique=True)
    # blocked_ips: index ip and TTL on expireAt
    await db.blocked_ips.create_index("ip")
    try:
        await db.blocked_ips.create_index("expireAt", expireAfterSeconds=0)
    except Exception:
        LOG.debug("Could not create TTL index; it may already exist or require privileges.")


async def load_policy_config():
    """Load detection policy from MongoDB, creating defaults if necessary."""
    global CONFIG_CACHE
    defaults = {
    "_id": CONFIG_DOC_ID,
    "threshold": DEFAULT_THRESHOLD,
    "block_duration_sec": DEFAULT_BLOCK_DURATION_SEC,
    "blocking_enabled": True,
    "updated_at": datetime.utcnow()
     }
    existing = await db.config.find_one({"_id": CONFIG_DOC_ID})
    if not existing:
        await db.config.insert_one(defaults)
        CONFIG_CACHE = defaults
        LOG.info(
            "Created default detection policy config: %s",
            {k: defaults[k] for k in ("threshold", "block_duration_sec")},
        )
        return CONFIG_CACHE

    CONFIG_CACHE = {
        "_id": CONFIG_DOC_ID,
        "threshold": float(existing.get("threshold", DEFAULT_THRESHOLD)),
        "block_duration_sec": int(
            existing.get("block_duration_sec", DEFAULT_BLOCK_DURATION_SEC)
        ),
        "blocking_enabled": bool(existing.get("blocking_enabled", True)),
        "updated_at": existing.get("updated_at"),
    }
    LOG.info(
        "Loaded detection policy config: %s",
        {k: CONFIG_CACHE[k] for k in ("threshold", "block_duration_sec", "blocking_enabled")},
    )
    return CONFIG_CACHE

# ---------- Blocking helpers (run in thread) ----------
def _iptables_available():
    return shutil.which("iptables") is not None

def block_ip_iptables(ip: str) -> bool:
    """Apply iptables rule to drop incoming traffic from ip.
    Will only run if USE_REAL_BLOCKING is True and iptables exists.
    """
    # Safety: avoid blocking private/local addresses
    private_prefixes = ("127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
                        "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.",
                        "172.28.", "172.29.", "172.30.", "172.31.")
    if ip.startswith(private_prefixes):
        LOG.info("Refuse to block private IP: %s", ip)
        return False

    if not USE_REAL_BLOCKING:
        LOG.info("USE_REAL_BLOCKING not enabled — skipping real iptables for %s (mock)", ip)
        return False

    if not _iptables_available():
        LOG.warning("iptables not found on host — cannot apply real block for %s", ip)
        return False

    try:
        # Use sudo if not running as root — environment must allow passwordless sudo or run service as root
        cmd = ["sudo", "iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"]
        subprocess.check_call(cmd)
        LOG.info("iptables DROP inserted for %s", ip)
        return True
    except subprocess.CalledProcessError:
        LOG.exception("iptables call failed for %s", ip)
        return False
    except Exception:
        LOG.exception("Unexpected error while attempting iptables block for %s", ip)
        return False

def unblock_ip_iptables(ip: str) -> bool:
    if not USE_REAL_BLOCKING:
        LOG.info("USE_REAL_BLOCKING not enabled — skipping real iptables unblock for %s (mock)", ip)
        return False

    if not _iptables_available():
        LOG.warning("iptables not found on host — cannot remove block for %s", ip)
        return False

    try:
        cmd = ["sudo", "iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"]
        subprocess.check_call(cmd)
        LOG.info("iptables DROP removed for %s", ip)
        return True
    except subprocess.CalledProcessError:
        LOG.exception("Failed to remove iptables rule for %s", ip)
        return False
    except Exception:
        LOG.exception("Unexpected error while attempting iptables unblock for %s", ip)
        return False

def classify_attack_type(fv) -> str:
    """Classify attack type based on flow characteristics."""
    # Port scanning: high unique destination ports, low packets per port
    if fv.unique_dst_ports > 10 and fv.total_packets / max(fv.unique_dst_ports, 1) < 5:
        return "Port Scan"
    
    # DDoS/DoS: very high packet rate or byte rate
    if fv.pkts_per_sec > 1000 or fv.bytes_per_sec > 1000000:
        return "DDoS"
    
    # SSH/Brute Force: high SYN count with moderate packet rate
    if fv.syn_count > 20 and fv.pkts_per_sec > 10:
        return "Brute Force"
    
    # Bot/Low-and-slow: moderate packet rate, long duration
    if fv.duration > 10 and fv.pkts_per_sec < 50:
        return "Bot"
    
    # Default: generic attack
    return "Suspicious Activity"

async def schedule_block_and_unblock(ip: str, duration_sec: int, *, reason: str = "auto-detect", actor: str = "model", note: Optional[str] = None):
    """Insert blocked_ips doc with expireAt so Mongo TTL removes it, and perform local iptables block/unblock."""
    # Check if IP is already blocked (prevent duplicate entries)
    existing = await db.blocked_ips.find_one({"ip": ip})
    if existing:
        LOG.info("IP %s is already blocked (doc %s), skipping duplicate block", ip, existing.get("_id"))
        return
    
    unblock_at = datetime.utcnow() + timedelta(seconds=duration_sec)
    doc = {
        "ip": ip,
        "blocked_at": datetime.utcnow(),
        "unblock_at": unblock_at,
        "duration_sec": duration_sec,
        "reason": reason,
        "actor": actor,
        "expireAt": unblock_at  # TTL index will remove this doc when time arrives
    }
    if note:
        doc["note"] = note
    res = await db.blocked_ips.insert_one(doc)
    LOG.info("Inserted blocked_ips doc %s for %s", res.inserted_id, ip)

    # ALSO store in permanent history collection (never expires)
    history_doc = {
        "ip": ip,
        "blocked_at": datetime.utcnow(),
        "unblock_at": unblock_at,
        "duration_sec": duration_sec,
        "reason": reason,
        "actor": actor,
    }
    if note:
        history_doc["note"] = note
    await db.blocked_ips_history.insert_one(history_doc)
    LOG.info("Stored block history for %s", ip)

    # Apply iptables rule in thread (best-effort)
    loop = asyncio.get_running_loop()
    ok = await loop.run_in_executor(executor, block_ip_iptables, ip)
    if not ok:
        LOG.warning("Local iptables block failed or skipped for %s; entry still exists in DB", ip)

    # schedule local unblock after duration (best effort)
    async def delayed_unblock():
        await asyncio.sleep(duration_sec + 1)
        await loop.run_in_executor(executor, unblock_ip_iptables, ip)

    asyncio.create_task(delayed_unblock())


async def remove_block(ip: str):
    """Remove block entry and attempt iptables cleanup."""
    await db.blocked_ips.delete_many({"ip": ip})
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(executor, unblock_ip_iptables, ip)

# ---------- FastAPI startup/shutdown ----------
@app.on_event("startup")
async def startup():
    global mongo_client, db
    LOG.info("Starting application. MONGO_URI=%s DB=%s", MONGO_URI, DB_NAME)
    # Create Mongo client with TLS CA bundle if SSL_CERT_FILE provided in environment
    mongo_kwargs = {}
    cert_file = os.getenv("SSL_CERT_FILE")
    if cert_file:
        mongo_kwargs["tls"] = True
        mongo_kwargs["tlsCAFile"] = cert_file

    # If USE_REAL_BLOCKING requested but iptables missing, log a warning
    if USE_REAL_BLOCKING and not _iptables_available():
        LOG.warning("USE_REAL_BLOCKING is set but iptables binary not found on host. Blocking will be mocked in DB only.")

    if not ADMIN_API_KEY:
        LOG.warning("ADMIN_API_KEY not set; admin endpoints are exposed without authentication.")

    mongo_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=10000, **mongo_kwargs)
    db = mongo_client[DB_NAME]
    try:
        await create_indexes()
        await load_policy_config()
        LOG.info("Connected to MongoDB%s at %s; DB=%s",
                 " (secure)" if cert_file else "",
                 MONGO_URI,
                 DB_NAME)
    except Exception as e:
        LOG.exception("Failed to connect to MongoDB on startup: %s", e)
        raise

@app.on_event("shutdown")
async def shutdown():
    if mongo_client:
        mongo_client.close()

# ---------- status endpoint ----------
@app.get("/status")
async def get_status():
    """Return system health status including live capture activity."""
    # Check recent flow submissions (within last 10 seconds indicates active capture)
    recent_cutoff = datetime.utcnow() - timedelta(seconds=10)
    recent_flows = await db.flows.count_documents({"ts_start": {"$gte": recent_cutoff}})
    
    # Check total flows in last minute
    minute_cutoff = datetime.utcnow() - timedelta(seconds=60)
    minute_flows = await db.flows.count_documents({"ts_start": {"$gte": minute_cutoff}})
    
    return {
        "status": "ok",
        "timestamp": datetime.utcnow(),
        "live_capture_active": recent_flows > 0,
        "flows_last_10s": recent_flows,
        "flows_last_minute": minute_flows,
        "model_loaded": model is not None,
        "db_connected": db is not None,
    }

# ---------- detection endpoint ----------
@app.post("/detect")
async def detect(fv: FeatureVec, background_tasks: BackgroundTasks):
    policy = CONFIG_CACHE or {}
    threshold = float(policy.get("threshold", DEFAULT_THRESHOLD))
    block_duration_sec = int(policy.get("block_duration_sec", DEFAULT_BLOCK_DURATION_SEC))

    # 1) save flow doc
    flow_doc = {
        "ts_start": datetime.utcnow(),
        "src_ip": fv.src_ip,
        "total_packets": fv.total_packets,
        "total_bytes": fv.total_bytes,
        "duration": fv.duration,
        "pkts_per_sec": fv.pkts_per_sec,
        "bytes_per_sec": fv.bytes_per_sec,
        "syn_count": fv.syn_count,
        "unique_dst_ports": fv.unique_dst_ports,
        "extra": fv.extra or {}
    }
    res_flow = await db.flows.insert_one(flow_doc)
    # include _id in features for traceability
    flow_doc["_id"] = res_flow.inserted_id

    # 2) prepare dataframe with column names (ensures sklearn works without warnings)
    df = pd.DataFrame([[fv.total_packets, fv.total_bytes, fv.duration, fv.pkts_per_sec, fv.bytes_per_sec, fv.syn_count, fv.unique_dst_ports]],
                      columns=FEATURE_ORDER)
    # run synchronous model in threadpool
    loop = asyncio.get_running_loop()

    def model_predict(xdf):
        # ensure returns (pred, prob) where prob is positive-class prob
        proba = model.predict_proba(xdf)
        # if model has two columns, second is positive class
        prob = float(proba[0, 1]) if proba.shape[1] > 1 else float(proba[0, 0])
        pred = int(model.predict(xdf)[0])
        return pred, prob

    pred, prob = await loop.run_in_executor(executor, model_predict, df)

    is_attack = prob >= threshold
    
    # Classify attack type if it's an attack
    attack_type = classify_attack_type(fv) if is_attack else None

    alert_doc = {
        "detected_at": datetime.utcnow(),
        "src_ip": fv.src_ip,
        "features": flow_doc,
        "score": prob,
        "model_version": os.path.basename(MODEL_PATH),
        "attack": bool(is_attack),
        "attack_type": attack_type,
        "threshold": threshold,
        "model_prediction": int(pred),
    }
    
    # Save to production_data collection for future labeling and model improvement
    # Smart sampling: Only save if attack OR randomly sample 10% of benign traffic to avoid duplicates
    should_save = is_attack or (prob > 0.15) or (hash(fv.src_ip + str(fv.total_packets)) % 10 == 0)
    
    if should_save:
        production_data_doc = {
            "collected_at": datetime.utcnow(),
            "src_ip": fv.src_ip,
            "features": {
                "total_packets": fv.total_packets,
                "total_bytes": fv.total_bytes,
                "duration": fv.duration,
                "pkts_per_sec": fv.pkts_per_sec,
                "bytes_per_sec": fv.bytes_per_sec,
                "syn_count": fv.syn_count,
                "unique_dst_ports": fv.unique_dst_ports,
            },
            "prediction": {
                "score": prob,
                "is_attack": bool(is_attack),
                "attack_type": attack_type,
                "model_version": os.path.basename(MODEL_PATH),
                "threshold": threshold,
            },
            # Fields for analyst labeling
            "labeled": False,
            "true_label": None,  # Will be "attack" or "benign" after analyst review
            "true_attack_type": None,  # Specific attack type if true_label is "attack"
            "labeled_by": None,
            "labeled_at": None,
            "notes": None,
            "confidence": None,  # Analyst confidence: "high", "medium", "low"
        }
        await db.production_data.insert_one(production_data_doc)

    # 3) on attack: check whitelist, record alert, schedule block
    if alert_doc["attack"]:
        wl = await db.whitelist.find_one({"ip": fv.src_ip})
        if wl:
            alert_doc["note"] = "whitelisted"
            alert_doc["blocked"] = False
            await db.alerts.insert_one(alert_doc)
            return {"alert": False, "score": round(prob,4), "note": "whitelisted"}
        # not whitelisted: insert alert, schedule block (if enabled)
        res = await db.alerts.insert_one(alert_doc)
        # schedule blocking & unblock (background task) only if blocking is enabled
        if CONFIG_CACHE.get("blocking_enabled", True):
            background_tasks.add_task(
                schedule_block_and_unblock,
                fv.src_ip,
                block_duration_sec,
                reason=attack_type,
                actor="model",
            )
        return {
            "alert_id": str(res.inserted_id),
            "alert": True,
            "attack_type": attack_type,
            "score": round(prob,4),
            "threshold": threshold,
            "block_duration_sec": block_duration_sec,
        }
    else:
        # benign -> just store alert doc
        await db.alerts.insert_one(alert_doc)
        return {"alert": False, "score": round(prob,4), "threshold": threshold}

# ---------- helper endpoints ----------
@app.get("/alerts/recent")
async def recent_alerts(limit: int = 20):
    cursor = db.alerts.find().sort("detected_at", -1).limit(limit)
    out = []
    async for d in cursor:
        out.append(make_jsonable(d))
    return out

@app.get("/blocked")
async def blocked_list(limit: int = 100):
    cursor = db.blocked_ips.find().sort("blocked_at", -1).limit(limit)
    out = []
    async for d in cursor:
        out.append(make_jsonable(d))
    return out

@app.get("/blocked/history")
async def blocked_history(limit: int = 5000):
    """Get full block history (including expired blocks)"""
    cursor = db.blocked_ips_history.find().sort("blocked_at", -1).limit(limit)
    out = []
    async for d in cursor:
        out.append(make_jsonable(d))
    return out

@app.get("/whitelist")
async def get_whitelist(limit: int = 100, admin: bool = Depends(require_admin_token)):
    cursor = db.whitelist.find().sort("created_at", -1).limit(limit)
    out = []
    async for doc in cursor:
        out.append(make_jsonable(doc))
    return out


@app.post("/whitelist/add")
async def add_whitelist(entry: IPNote, admin: bool = Depends(require_admin_token)):
    note = entry.note or ""
    try:
        res = await db.whitelist.update_one(
            {"ip": entry.ip},
            {"$set": {"note": note, "created_at": datetime.utcnow()}},
            upsert=True,
        )
        CONFIG_CACHE.setdefault("whitelist_cache_bust", datetime.utcnow().isoformat())
        return {"ok": True, "upserted": str(res.upserted_id) if res.upserted_id else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/whitelist/{ip}")
async def remove_whitelist(ip: str, admin: bool = Depends(require_admin_token)):
    res = await db.whitelist.delete_one({"ip": ip})
    return {"ok": True, "deleted": res.deleted_count}


@app.post("/admin/block")
async def manual_block(payload: ManualBlockRequest, admin: bool = Depends(require_admin_token)):
    duration = payload.duration_sec or int(CONFIG_CACHE.get("block_duration_sec", DEFAULT_BLOCK_DURATION_SEC))
    if duration <= 0:
        raise HTTPException(status_code=400, detail="duration_sec must be positive")
    # Avoid blocking private IPs through same safeguards in block helper
    await schedule_block_and_unblock(
        payload.ip,
        duration,
        reason="manual",
        actor="admin",
        note=payload.note,
    )
    return {"ok": True, "ip": payload.ip, "duration_sec": duration}


@app.delete("/admin/block/{ip}")
async def manual_unblock(ip: str, admin: bool = Depends(require_admin_token)):
    await remove_block(ip)
    return {"ok": True, "ip": ip}


@app.get("/admin/config")
async def get_config(admin: bool = Depends(require_admin_token)):
    return make_jsonable(dict(CONFIG_CACHE))


@app.post("/admin/config")
async def update_config(payload: ConfigUpdate, admin: bool = Depends(require_admin_token)):
    updates: Dict[str, Any] = {}

    if payload.threshold is not None:
        if not (0.0 <= payload.threshold <= 1.0):
            raise HTTPException(status_code=400, detail="threshold must be between 0 and 1")
        updates["threshold"] = float(payload.threshold)

    if payload.block_duration_sec is not None:
        if payload.block_duration_sec <= 0:
            raise HTTPException(status_code=400, detail="block_duration_sec must be positive")
        updates["block_duration_sec"] = int(payload.block_duration_sec)

    if payload.blocking_enabled is not None:
        updates["blocking_enabled"] = bool(payload.blocking_enabled)

    if not updates:
        return {"ok": True, "config": make_jsonable(dict(CONFIG_CACHE))}

    updates["updated_at"] = datetime.utcnow()

    try:
        await db.config.update_one({"_id": CONFIG_DOC_ID}, {"$set": updates}, upsert=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    CONFIG_CACHE.update(updates)
    return {"ok": True, "config": make_jsonable(dict(CONFIG_CACHE))}

# ---------- admin export (CSV) ----------
from fastapi.responses import StreamingResponse

@app.get("/admin/export_flows")
async def export_flows(limit: int = 0, admin: bool = Depends(require_admin_token)):
    """
    Stream flows as CSV. Use ?limit=N to restrict rows (0 = all).
    Fields: ts_start,src_ip,total_packets,total_bytes,duration,pkts_per_sec,bytes_per_sec,
            syn_count,unique_dst_ports,flow_id,label,alert_id,alert_score,detected_at
    """
    header = [
        "ts_start","src_ip","total_packets","total_bytes","duration",
        "pkts_per_sec","bytes_per_sec","syn_count","unique_dst_ports",
        "flow_id","label","alert_id","alert_score","detected_at"
    ]

    async def generator():
        # yield header row
        yield (",".join(header) + "\n").encode()

        cursor = db.flows.find().sort("ts_start", 1)
        if limit and int(limit) > 0:
            cursor = cursor.limit(int(limit))

        async for flow in cursor:
            # try to find an alert referencing this flow
            alert = await db.alerts.find_one({"features._id": flow.get("_id")})
            label = "1" if alert else "0"
            alert_id = str(alert["_id"]) if alert else ""
            alert_score = str(alert.get("score", "")) if alert else ""
            detected_at = alert.get("detected_at", "")
            if hasattr(detected_at, "isoformat"):
                detected_at = detected_at.isoformat()

            row_vals = []
            for k in ["ts_start","src_ip","total_packets","total_bytes","duration","pkts_per_sec","bytes_per_sec","syn_count","unique_dst_ports"]:
                v = flow.get(k, "")
                if hasattr(v, "isoformat"):
                    v = v.isoformat()
                row_vals.append(str(v))
            row_vals += [str(flow.get("_id","")), label, alert_id, alert_score, str(detected_at)]
            yield (",".join(row_vals) + "\n").encode()

    headers = {
        "Content-Disposition": 'attachment; filename="flows_export.csv"'
    }
    return StreamingResponse(generator(), media_type="text/csv", headers=headers)


# ---------- Production Data Collection Endpoints ----------
@app.get("/production_data/stats")
async def get_production_data_stats():
    """Get statistics about collected production data."""
    total = await db.production_data.count_documents({})
    labeled = await db.production_data.count_documents({"labeled": True})
    unlabeled = total - labeled
    
    predicted_attacks = await db.production_data.count_documents({"prediction.is_attack": True})
    predicted_benign = total - predicted_attacks
    
    true_attacks = await db.production_data.count_documents({"true_label": "attack"})
    true_benign = await db.production_data.count_documents({"true_label": "benign"})
    
    # Recent samples
    recent = []
    cursor = db.production_data.find().sort("collected_at", -1).limit(10)
    async for doc in cursor:
        recent.append(make_jsonable(doc))
    
    return {
        "total": total,
        "labeled": labeled,
        "unlabeled": unlabeled,
        "predicted_attacks": predicted_attacks,
        "predicted_benign": predicted_benign,
        "true_attacks": true_attacks,
        "true_benign": true_benign,
        "recent_samples": recent,
    }


@app.get("/production_data/unlabeled")
async def get_unlabeled_samples(limit: int = 20, skip: int = 0, 
                                filter_type: str = "all"):
    """Get unlabeled samples for labeling."""
    query = {"labeled": False}
    
    if filter_type == "attacks":
        query["prediction.is_attack"] = True
    elif filter_type == "benign":
        query["prediction.is_attack"] = False
    
    cursor = db.production_data.find(query).sort("collected_at", -1).skip(skip).limit(limit)
    samples = []
    async for doc in cursor:
        samples.append(make_jsonable(doc))
    
    return {"samples": samples, "count": len(samples)}


@app.post("/production_data/label/{sample_id}")
async def label_sample(sample_id: str, payload: dict):
    """Label a production data sample."""
    from bson import ObjectId
    
    try:
        oid = ObjectId(sample_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid sample ID")
    
    update_doc = {
        "labeled": True,
        "true_label": payload.get("true_label"),  # "attack" or "benign"
        "true_attack_type": payload.get("true_attack_type"),
        "labeled_by": payload.get("labeled_by", "analyst"),
        "labeled_at": datetime.utcnow(),
        "confidence": payload.get("confidence", "medium"),
        "notes": payload.get("notes"),
    }
    
    result = await db.production_data.update_one(
        {"_id": oid},
        {"$set": update_doc}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    return {"ok": True, "sample_id": sample_id}


@app.get("/production_data/export")
async def export_production_data(min_confidence: str = "low"):
    """Export labeled production data as CSV."""
    import io
    
    # Confidence filter
    confidence_levels = {'high': 3, 'medium': 2, 'low': 1}
    min_conf_value = confidence_levels.get(min_confidence, 1)
    
    query = {
        "labeled": True,
        "confidence": {"$in": [k for k, v in confidence_levels.items() if v >= min_conf_value]}
    }
    
    cursor = db.production_data.find(query)
    
    # Generate CSV
    async def gen_csv():
        yield "src_ip,total_packets,total_bytes,duration,pkts_per_sec,bytes_per_sec,syn_count,unique_dst_ports,label,attack_type,model_prediction,model_score,confidence,labeled_by,labeled_at,notes\n"
        
        async for sample in cursor:
            features = sample['features']
            prediction = sample['prediction']
            
            row = [
                sample['src_ip'],
                str(features['total_packets']),
                str(features['total_bytes']),
                str(features['duration']),
                str(features['pkts_per_sec']),
                str(features['bytes_per_sec']),
                str(features['syn_count']),
                str(features['unique_dst_ports']),
                sample.get('true_label', ''),
                sample.get('true_attack_type', ''),
                str(prediction['is_attack']),
                str(prediction['score']),
                sample.get('confidence', ''),
                sample.get('labeled_by', ''),
                sample.get('labeled_at', '').isoformat() if sample.get('labeled_at') else '',
                sample.get('notes', '').replace(',', ';'),  # Escape commas
            ]
            yield ','.join(row) + '\n'
    
    return StreamingResponse(gen_csv(), media_type="text/csv", headers={
        "Content-Disposition": f"attachment; filename=labeled_production_data.csv"
    })
