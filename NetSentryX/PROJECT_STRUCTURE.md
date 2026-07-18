# NetSentryX - Project Structure Guide 📁

## 🎯 System Overview

**NetSentryX** is an AI-powered Network Intrusion Detection System (IDS) that:
1. **Captures** network packets in real-time
2. **Extracts** flow features (packets, bytes, rates, ports, protocols)
3. **Classifies** traffic using a RandomForest ML model trained on CIC-IDS2017
4. **Blocks** malicious IPs automatically when confidence exceeds threshold
5. **Visualizes** threats through a React dashboard with charts and alerts

**Tech Stack:** Python (FastAPI, Scapy, scikit-learn) + React (Vite, TypeScript, Recharts) + MongoDB Atlas

---

## 📂 Directory & File Breakdown

### `/api/` - Backend API Server
**Purpose:** FastAPI application handling detection, blocking, alerts, and database operations.

| File | What It Does |
|------|-------------|
| `app.py` | **Main API server** - Loads ML model, handles `/detect` endpoint, manages blocked IPs, stores alerts in MongoDB |
| `add_whitelist.py` | CLI tool to add trusted IPs to whitelist (bypasses detection) |
| `query_alerts.py` | CLI tool to query MongoDB for recent alerts |
| `app_dummy_backup.py` | Backup version of API (for rollback) |

**How it works:** Receives flow features → Model predicts attack probability → If ≥ threshold, saves alert to DB and adds IP to blocked list with expiry timer.

---

### `/models/` - Machine Learning Training & Inference
**Purpose:** Train and retrain the RandomForest model using labeled attack data.

| File | What It Does |
|------|-------------|
| `train.py` | **Primary training script** - Loads CIC-IDS2017 CSV files, trains RandomForest (100 trees), saves to `saved_models/rf_model.joblib` |
| `train_real.py` | Alternative training script using real production data |
| `generate_synthetic_data.py` | Creates synthetic attack flows for testing |
| `export_flows_from_mongo.py` | Exports production flows from MongoDB for retraining |
| `saved_models/rf_model.joblib` | **Trained model file** (140KB) - Used by API for predictions |
| `saved_models/rf_model_real.joblib` | Backup model trained on real data |

**How it works:** Reads CSV files with labeled attacks → Extracts 7 features (pkts, bytes, duration, rates, SYN count, ports) → Trains RandomForest → Exports `.joblib` model → API loads model at startup.

---

### `/realtime_agent/` - Packet Capture & Feature Extraction
**Purpose:** Captures live network traffic and converts packets to ML features.

| File | What It Does |
|------|-------------|
| `realtime_extractor.py` | **Main capture script** - Uses Scapy to sniff packets, groups into 5-second flows, extracts features, sends to `/detect` API |
| `window_extractor.py` | Alternative extractor using time-window aggregation |
| `pcap_to_features.py` | Converts `.pcap` files to feature vectors (for offline analysis) |
| `send_sample_to_api.py` | Test script to send sample flows to API |
| `generate_sample_pcap.py` | Creates test `.pcap` files for development |

**How it works:** Sniffs packets → Groups by source IP in 5s windows → Counts packets, bytes, SYN flags, unique ports → Calculates rates → Sends JSON to `/detect` endpoint.

---

### `/dashboard/` - React Frontend UI
**Purpose:** Interactive web dashboard for monitoring alerts, blocked IPs, and attack trends.

| Directory/File | What It Does |
|----------------|-------------|
| `src/components/` | React components (AttackTrendsChart, AttackTypePieChart, BlockedIPsTable, etc.) |
| `src/pages/` | Page layouts (Dashboard, SecurityAnalytics, NetworkMonitor) |
| `src/api/api.ts` | API client for fetching alerts, blocked IPs, stats from backend |
| `src/types/` | TypeScript interfaces (AlertDoc, BlockedIP, etc.) |
| `package.json` | NPM dependencies (React, Recharts, Axios, TailwindCSS) |
| `vite.config.ts` | Vite bundler configuration |

**How it works:** Polls `/alerts/recent` and `/blocked` every 30s → Updates charts and tables → User clicks filters to change time ranges → Recharts renders pie/line/bar charts.

---

### `/data/` - Training Datasets & Exports
**Purpose:** Store attack datasets and exported production data.

| File/Folder | What It Does |
|-------------|-------------|
| `cic_raw/` | **CIC-IDS2017 dataset** (8 CSV files, 884MB total) - Friday-DDos, PortScan, WebAttacks, etc. **Not in git** (download from [UNB](https://www.unb.ca/cic/datasets/ids-2017.html)) |
| `flows_labeled.csv` | Labeled flows for retraining |
| `flows_export.csv` | Exported production flows from MongoDB |
| `synthetic_flows.csv` | Synthetic attack data for testing |
| `sample.pcap` | Sample packet capture file |

**How it works:** `train.py` reads CSVs → Extracts 7 features from each row → Labels: "BENIGN" or attack type → Trains model.

---

### `/test/` - Testing & Demo Scripts
**Purpose:** Test the detection API with simulated attacks.

| File | What It Does |
|------|-------------|
| `quick_test.py` | **Quick demo script** - Sends 5 attack patterns to API, shows detection results |
| `interactive_test.py` | Menu-driven testing tool (choose attack type, adjust threshold) |
| `manual_tests.sh` | cURL commands for manual API testing |
| `README.md` | Testing guide with scenarios and expected scores |

**How it works:** Crafts JSON payloads with attack characteristics → POSTs to `/detect` → Prints response (attack_type, confidence, blocked status).

---

### `/scripts/` - Utility Scripts
**Purpose:** Helper scripts for data generation and maintenance.

| File | What It Does |
|------|-------------|
| `generate_synthetic_flows.py` | Creates synthetic attack flows for training data augmentation |

---

### `/desktop_app/` - Electron Desktop Shell
**Purpose:** Wraps the FastAPI backend, the dashboard build output, and the trained ML model into a distributable desktop installer.

| File | What It Does |
|------|-------------|
| `package.json` | Configures Electron build targets, bundles `api/`, `dashboard/dist/`, and `models/saved_models/rf_model.joblib`, and outputs an NSIS `.exe` installer |
| `main.js` | Launches the backend (`uvicorn`) and opens the built dashboard inside a Chromium window without exposing developer menus |
| `README.md` | Steps to build the dashboard, install dependencies, run in dev mode, and package the final installer via `electron-builder` |

**Packaging notes:** The installer produced by `electron-builder` already includes the ML model and backend assets because they are listed under `files` in `package.json`. To ensure the packaged `uvicorn` call works, bundle a portable Python interpreter or instruct users to install Python beforehand.

---

## 🔧 Root Directory Files

| File | What It Does |
|------|-------------|
| `README.md` | Project overview, installation guide, dataset instructions |
| `RUNBOOK.md` | Quick start commands, API endpoints, troubleshooting |
| `VIDEO_SCRIPT.md` | Recording guide for demo video (100-second script) |
| `PROJECT_STRUCTURE.md` | This file - explains every directory and file |
| `requirements.txt` | Python dependencies (FastAPI, Scapy, scikit-learn, pymongo, etc.) |
| `.env` | Configuration (MongoDB URI, SSL cert path, admin key) |
| `.gitignore` | Excludes `.venv/`, `node_modules/`, `data/cic_raw/`, large models |
| `capture.pcap` | Sample packet capture (for testing) |
| `check_scapy.py` | Verifies Scapy installation |
| `train_cic.py` | Alternative training script |

---

## 🔄 How The System Works (End-to-End Flow)

### 1️⃣ **Packet Capture Phase**
```
Network Traffic → realtime_extractor.py (Scapy) → 5s flow windows
```
- Captures all TCP/UDP packets on interface
- Groups by source IP
- Counts: packets, bytes, SYN flags, unique destination ports
- Calculates: packets/sec, bytes/sec, duration

### 2️⃣ **Feature Extraction Phase**
```
Flow → 7 Features: [total_pkts, total_bytes, duration, pkts/sec, bytes/sec, syn_count, unique_dst_ports]
```
- Example DDoS: `[500, 100000, 2.5, 200, 40000, 250, 1]`
- Example Benign: `[10, 5000, 5.0, 2, 1000, 1, 3]`

### 3️⃣ **ML Detection Phase**
```
Features → RandomForest Model → Attack Probability (0.0-1.0)
```
- Model trained on 2.8M flows from CIC-IDS2017
- 100 decision trees vote on classification
- Output: `{"attack_type": "DDoS", "confidence": 0.86, "is_attack": true}`

### 4️⃣ **Blocking & Storage Phase**
```
If confidence ≥ threshold (default 0.5):
  → Save to MongoDB (alerts collection)
  → Add IP to blocked_ips (expires in 300s)
  → Return {"blocked": true}
```

### 5️⃣ **Dashboard Visualization Phase**
```
Dashboard polls /alerts/recent every 30s
  → Updates Attack Trends chart (line graph)
  → Updates Attack Types pie chart
  → Updates Blocked IPs table with countdown timers
```

---

## 🎬 Quick Demo Flow

```bash
# Terminal 1: Start API
source .venv/bin/activate
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Start Dashboard
cd dashboard && npm run dev

# Terminal 3: Run Test
python3 test/quick_test.py

# Browser: Open http://localhost:5173
# Watch dashboard update in real-time!
```

---

## 📊 Data Flow Diagram

```
┌─────────────────┐
│ Network Traffic │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Scapy Packet Sniffer│ (realtime_extractor.py)
└────────┬────────────┘
         │
         ▼
┌──────────────────────┐
│ Feature Extraction   │ (7 features per flow)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ POST /detect API     │ (app.py)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ RandomForest Model   │ (rf_model.joblib)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Threshold Check      │ (≥ 0.5 = attack)
└────┬────────┬────────┘
     │        │
     ▼        ▼
 ┌─────┐  ┌──────────┐
 │Allow│  │ Block IP │
 └─────┘  └────┬─────┘
               │
               ▼
       ┌───────────────┐
       │ MongoDB Atlas │ (alerts + blocked_ips)
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐
       │ React Dashboard│ (charts, tables, stats)
       └───────────────┘
```

---

## 🔐 Security Features

- **Automatic IP blocking** with configurable expiry (default 5 minutes)
- **Whitelist** for trusted IPs (never blocked)
- **Admin API authentication** (optional `ADMIN_API_KEY` in `.env`)
- **Threshold tuning** to balance detection vs false positives
- **Audit trail** - all detections logged to MongoDB

---

## 📈 Model Performance

| Metric | Value |
|--------|-------|
| Training Dataset | CIC-IDS2017 (2.8M flows) |
| Attack Types | DDoS, Port Scan, DoS, Web Attacks, Brute Force, Infiltration, Botnet |
| Model Type | RandomForest (100 trees) |
| Features | 7 (packets, bytes, duration, rates, SYN, ports) |
| Accuracy | ~99% on test set |
| False Positive Rate | < 1% (with threshold 0.5) |

---

**Author:** Dilusha  
**License:** MIT  
**GitHub:** [dilusha-c/NetSentryX](https://github.com/dilusha-c/NetSentryX)
