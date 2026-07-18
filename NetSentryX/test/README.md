# IDS Testing Guide

This directory contains all testing tools for the Intrusion Detection System.

## 🚀 Quick Start

### Option 1: Interactive Testing (Recommended)
```bash
python3 test/interactive_test.py
```
- Menu-driven interface
- Test individual attacks or run all at once
- Check alerts and blocked IPs
- Adjust threshold on the fly

### Option 2: Quick Automated Test
```bash
python3 test/quick_test.py
```
- Runs all 5 attack patterns automatically
- Shows summary results
- Good for quick demos

### Option 3: Manual cURL Commands
```bash
# View all available commands
bash test/manual_tests.sh

# Then copy/paste individual commands to test
```

## 📋 Test Scenarios

| Test | Expected Behavior (threshold=0.25) |
|------|-----------------------------------|
| Benign Traffic | ✅ Allowed (score ~0.01) |
| Port Scan | 🚨 May be blocked (score ~0.07) |
| DDoS Flood | 🚨 May be blocked (score ~0.08) |
| SYN Flood | ✅ May be allowed (score ~0.02) |
| Brute Force | 🚨 **BLOCKED** (score ~0.29) |

## 🔧 Threshold Settings

**For Demonstrations:**
```bash
# Lower threshold to detect more attacks
curl -X POST http://127.0.0.1:8000/admin/config \
  -H "Content-Type: application/json" \
  -d '{"threshold": 0.25, "block_duration_sec": 300}'
```

**For Production:**
```bash
# Higher threshold for fewer false positives
curl -X POST http://127.0.0.1:8000/admin/config \
  -H "Content-Type: application/json" \
  -d '{"threshold": 0.70, "block_duration_sec": 600}'
```

## 📊 Check Results

**Blocked IPs:**
```bash
curl http://127.0.0.1:8000/blocked
```

**Recent Alerts:**
```bash
curl http://127.0.0.1:8000/alerts/recent?limit=10
```

**System Status:**
```bash
curl http://127.0.0.1:8000/status
```

## ⚠️ Prerequisites

Make sure the API is running:
```bash
cd /home/dilusha/ids-project
source .venv/bin/activate
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```

Dashboard (optional):
```bash
cd dashboard
npm run dev
```

## 🎯 Demo Workflow

1. **Start systems** (API + Dashboard)
2. **Lower threshold**: Use option 9 in interactive test
3. **Run all tests**: Use option 6 in interactive test
4. **Check blocked IPs**: Use option 8 in interactive test
5. **Show dashboard** with blocked IPs and alerts
