# NetSentryX 🛡️

> **AI-Powered Network Intrusion Detection & Auto-Blocking System**

Real-time threat detection using machine learning to automatically identify and block malicious network traffic.

---

## 🎯 What is NetSentryX?

NetSentryX monitors your network traffic in real-time, uses **machine learning** to detect attacks, and **automatically blocks** malicious IPs. Built with FastAPI, MongoDB Atlas, and React.

### Key Features

- ✅ **Real-time Detection** - Sub-second latency from packet to alert
- ✅ **ML-Powered** - RandomForest trained on CIC-IDS2017 dataset
- ✅ **Auto-Blocking** - Automatic IP blocking with iptables
- ✅ **Live Dashboard** - Beautiful React UI for monitoring
- ✅ **Self-Learning** - Improves accuracy with your production data
- ✅ **Attack Classification** - Identifies Port Scan, DDoS, Brute Force, Bot attacks

---

## 🚀 Quick Start

```bash
# 1. Start API Backend
cd /home/dilusha/ids-project && source .venv/bin/activate
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload

# 2. Start Packet Capture (new terminal)
cd /home/dilusha/ids-project && sudo ./start_capture.sh

# 3. Start Dashboard (new terminal)
cd /home/dilusha/ids-project/dashboard && npm run dev
```

**Open Dashboard:** http://localhost:5173

---

## 📋 Requirements

- Python 3.10+
- Node.js 18+
- MongoDB Atlas account
- Linux/WSL 2 (for packet capture)
- sudo access

---

## 🔧 Installation

```bash
# 1. Clone & setup Python
git clone https://github.com/dilusha-c/NetSentryX.git
cd NetSentryX
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Download CIC-IDS2017 Dataset
# Download from: https://www.unb.ca/cic/datasets/ids-2017.html
# Extract CSV files to: data/cic_raw/
# Required files:
#   - Monday-WorkingHours.pcap_ISCX.csv
#   - Tuesday-WorkingHours.pcap_ISCX.csv
#   - Wednesday-workingHours.pcap_ISCX.csv
#   - Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv
#   - Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv
#   - Friday-WorkingHours-Morning.pcap_ISCX.csv
#   - Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv
#   - Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv

# 3. Configure MongoDB (create .env file)
MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/idsdb"
SSL_CERT_FILE=/path/to/.venv/lib/python3.12/site-packages/certifi/cacert.pem

# 4. Train initial model
python models/train.py

# 5. Setup Dashboard
cd dashboard && npm install
```

**See [RUNBOOK.md](RUNBOOK.md) for detailed instructions.**

---

## 🏗️ Architecture

```
Network Traffic → Packet Capture → Feature Extraction
                                         ↓
                                   ML Model (RF)
                                         ↓
                            Attack? → Block IP + Alert
                                         ↓
                                  MongoDB Atlas
                                         ↓
                                  React Dashboard
```

**Components:**
- **Capture:** Scapy-based packet capture (5-sec windows)
- **Detection:** RandomForest classifier (7 features)
- **Storage:** MongoDB Atlas (alerts, flows, blocks)
- **UI:** React + Vite dashboard with real-time updates
- **Blocking:** iptables integration (Linux/WSL)

---

## 📊 Detection Pipeline

1. **Capture** network packets (ALL IP traffic)
2. **Extract** 7 features: packets, bytes, duration, rates, SYN count, unique ports
3. **Predict** attack probability using ML model
4. **Classify** attack type (Port Scan, DDoS, Brute Force, Bot)
5. **Block** malicious IPs automatically
6. **Display** alerts in real-time dashboard

---

## 🎯 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /alerts/recent` | Recent detection alerts |
| `GET /blocked` | Currently blocked IPs |
| `POST /detect` | Submit flow for detection |
| `GET /admin/config` | Detection policy settings |
| `POST /whitelist/add` | Add trusted IP |
| `GET /production_data/stats` | Training data statistics |

**Full API docs:** See [RUNBOOK.md](RUNBOOK.md)

---

## 🤖 Machine Learning

**Model:** RandomForest (100 trees)  
**Dataset:** CIC-IDS2017 (2.8M flows)  
**Accuracy:** ~99% on test set  
**Features:** 7 flow-level metrics  

### Improve with Your Data

```bash
# Auto-collect production data → Label → Retrain → Deploy
curl http://127.0.0.1:8000/production_data/stats
python api/label_data_simple.py
python models/train.py --production-data data/labeled_production.csv --use-smote
```

**Result:** 5-15% better accuracy on YOUR network!

---

## 📁 Project Structure

```
NetSentryX/
├── api/app.py                 # FastAPI backend + ML detection
├── models/train.py            # Model training/retraining
├── realtime_agent/            # Packet capture & extraction
├── dashboard/src/             # React dashboard
├── data/cic_raw/              # CIC-IDS2017 dataset
├── RUNBOOK.md                 # Detailed setup guide
└── .env                       # Configuration
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | `pkill -f "uvicorn api.app:app"` |
| Permission denied (capture) | Use `sudo ./start_capture.sh` |
| MongoDB connection failed | Check `.env` credentials + IP whitelist |
| Dashboard build fails | `rm -rf node_modules && npm install` |

---

## 📖 Documentation

- **[RUNBOOK.md](RUNBOOK.md)** - Complete setup & operation guide
- **[API Documentation](RUNBOOK.md#-key-api-endpoints)** - Endpoint reference
- **[Model Training Guide](RUNBOOK.md#-improve-model-with-production-data)** - Retrain with your data

---

## 🤝 Contributing

Improvements welcome! Areas to explore:
- Additional ML models (XGBoost, Neural Networks)
- Advanced feature engineering
- Docker/Kubernetes deployment
- More attack type detection

---

## 📄 License

MIT License - See LICENSE file

---

## 👨‍💻 Author

**Dilusha** - Network Security & Machine Learning Enthusiast

---

## 🙏 Acknowledgments

- **CIC-IDS2017** - Canadian Institute for Cybersecurity
- **FastAPI** - Modern Python web framework
- **scikit-learn** - ML library
- **Scapy** - Packet manipulation

---

<div align="center">

**⭐ Star this repo if you find it useful!**

[Report Bug](../../issues) • [Request Feature](../../issues) • [Documentation](RUNBOOK.md)

</div>
