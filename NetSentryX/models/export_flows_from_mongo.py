# models/export_flows_from_mongo.py
"""
Export flows from MongoDB into a CSV for model training.
It tries to label flows by looking up recent alerts referencing the flow._id.
Usage:
  export MONGO_URI="..." && python models/export_flows_from_mongo.py --out data/flows_labeled.csv --lookback-hours 72
"""

import os
import csv
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from bson import ObjectId
from datetime import datetime, timedelta

FEATURE_FIELDS = [
    "ts_start",
    "src_ip",
    "total_packets",
    "total_bytes",
    "duration",
    "pkts_per_sec",
    "bytes_per_sec",
    "syn_count",
    "unique_dst_ports",
    # add your extra keys here if present: avg_pkt_size, unique_dst_ips, tcp_ack, tcp_rst, tcp_fin
]

async def run(uri, out_path, lookback_hours):
    client = AsyncIOMotorClient(uri)
    db = client["idsdb"]

    cutoff = datetime.utcnow() - timedelta(hours=lookback_hours) if lookback_hours else None
    query = {}
    if cutoff:
        query["ts_start"] = {"$gte": cutoff}

    cursor = db.flows.find(query).sort("ts_start", 1)
    print("Exporting flows to", out_path)
    with open(out_path, "w", newline="") as f:
        writer = csv.writer(f)
        header = FEATURE_FIELDS + ["flow_id", "label", "alert_id", "alert_score", "detected_at"]
        writer.writerow(header)
        i = 0
        async for flow in cursor:
            flow_id = flow.get("_id")
            # find alert for this flow (if any). We assume alerts.features._id references flow._id
            alert = await db.alerts.find_one({"features._id": flow_id})
            label = 1 if alert else 0
            alert_id = str(alert["_id"]) if alert else ""
            alert_score = alert["score"] if alert and "score" in alert else ""
            detected_at = alert["detected_at"].isoformat() if alert and "detected_at" in alert else ""
            row = []
            for fkey in FEATURE_FIELDS:
                val = flow.get(fkey)
                # normalize datetimes -> iso strings or numeric
                if getattr(val, "isoformat", None):
                    val = val.isoformat()
                row.append(val)
            row += [str(flow_id), label, alert_id, alert_score, detected_at]
            writer.writerow(row)
            i += 1
            if i % 500 == 0:
                print("Exported", i, "rows")
    client.close()
    print("Done. exported", i, "rows")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/flows_labeled.csv")
    parser.add_argument("--lookback-hours", type=int, default=0, help="0=all")
    args = parser.parse_args()
    uri = os.getenv("MONGO_URI")
    if not uri:
        print("MONGO_URI environment variable not set")
        return
    asyncio.run(run(uri, args.out, args.lookback_hours))

if __name__ == "__main__":
    main()
