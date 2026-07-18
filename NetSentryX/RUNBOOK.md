# NetSentryX - Quick Runbook 🛡️

> **AI-Powered Network Intrusion Detection & Auto-Blocking System**

---

## 🚀 Quick Start (3 Commands)

```bash
# Terminal 1: Start API
cd /home/dilusha/ids-project && source .venv/bin/activate
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Start Capture (ALL IP traffic)
cd /home/dilusha/ids-project && sudo ./start_capture.sh

# Terminal 3: Start Dashboard
cd /home/dilusha/ids-project/dashboard && npm run dev
```

**Open:** http://localhost:5173

**Stop Capture:** `./stop_capture.sh`

---

## 📋 Requirements

- Python 3.10+, Node.js 18+
- MongoDB Atlas (configured in `.env`)
- sudo access (packet capture)

---

## 🔧 Initial Setup (One-Time)

```bash
# 1. Python dependencies
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# 2. Configure .env file
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/idsdb"
SSL_CERT_FILE=/path/to/.venv/lib/python3.12/site-packages/certifi/cacert.pem

# 3. Dashboard dependencies
cd dashboard && npm install
```

---

## 🎯 Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/alerts/recent` | GET | Recent alerts |
| `/blocked` | GET | Blocked IPs |
| `/detect` | POST | Submit flow for detection |
| `/admin/config` | GET/POST | Detection policy (requires token) |
| `/whitelist/add` | POST | Add trusted IP |
| `/production_data/stats` | GET | ML improvement data stats |

---

## 🤖 How It Works

**Detection Pipeline:**
1. Capture packets (5s windows)
2. Extract 7 features (packets, bytes, duration, rates, SYN, ports)
3. ML model predicts attack probability
4. If ≥ threshold → Alert + Block IP
5. Auto-save to DB for model improvement

**Model:** RandomForest (100 trees) trained on CIC-IDS2017  
**Location:** `models/saved_models/rf_model.joblib`

---

## 🔄 Improve Model with Production Data

```bash
# 1. Check collected data
curl http://127.0.0.1:8000/production_data/stats

# 2. Label samples (via API or CLI)
python api/label_data_simple.py

# 3. Export labeled data
curl http://127.0.0.1:8000/production_data/export -o data/labeled_production.csv

# 4. Retrain model
python models/train.py --production-data data/labeled_production.csv --use-smote

# 5. Deploy new model
cp models/saved_models/rf_model_v2.joblib models/saved_models/rf_model.joblib
```

**Result:** 5-15% better accuracy on YOUR network!

---

## 🛠️ Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 8000 in use | `pkill -f "uvicorn api.app:app"` |
| Capture permission denied | Use `sudo` |
| MongoDB connection failed | Check `.env` MONGO_URI and IP whitelist |
| Dashboard won't start | `cd dashboard && rm -rf node_modules && npm install` |

---

## 📁 Project Structure

```
NetSentryX/
├── api/app.py                    # FastAPI backend + ML detection
├── models/train.py               # Model retraining script
├── realtime_agent/               # Packet capture
├── dashboard/src/                # React UI
├── data/cic_raw/                 # CIC-IDS2017 dataset
└── .env                          # Configuration
```

---

## 📊 Test Detection

```bash
# Send test attack
curl -X POST http://127.0.0.1:8000/detect -H "Content-Type: application/json" \
  -d '{"src_ip":"10.0.0.50","total_packets":200,"total_bytes":40000,"duration":1,
       "pkts_per_sec":200,"bytes_per_sec":40000,"syn_count":10,"unique_dst_ports":1}'

# Check alerts
curl http://127.0.0.1:8000/alerts/recent

# View blocked IPs
curl http://127.0.0.1:8000/blocked
```

---

**Author:** Dilusha | **License:** MIT
