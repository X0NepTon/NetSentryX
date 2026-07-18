# NetSentryX

> A graduation project for real-time network monitoring, machine-learning-based intrusion detection, and incident response.

NetSentryX collects flow-level network telemetry, classifies suspicious activity with a Random Forest model, records alerts in MongoDB, and presents the results in a React dashboard. It supports controlled IP blocking on Linux hosts, a whitelist, policy controls, incident history, and retraining data workflows.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology](#technology)
- [Quick start with Docker](#quick-start-with-docker)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Dashboard](#dashboard)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Model training](#model-training)
- [Safety notes](#safety-notes)
- [Documentation](#documentation)

## Features

- Real-time flow capture and feature extraction with Scapy.
- Machine-learning classification using seven flow-level features.
- Detection alerts with severity, confidence, timestamps, and traffic metadata.
- React dashboard for live monitoring, analytics, reports, incident details, model status, and playbooks.
- Blocked-IP management, block history, manual controls, and a trusted-IP whitelist.
- MongoDB storage for alerts, flow records, policy settings, and labelled data.
- Production-data labelling and export endpoints for model retraining.
- Docker Compose setup for the API, dashboard, and MongoDB.

## architecture

```text
Network traffic
      │
      ▼
Realtime capture agent ──► Flow feature extraction ──► FastAPI detection service
                                                             │
                              ┌──────────────────────────────┼──────────────────────────────┐
                              ▼                              ▼                              ▼
                        ML prediction                  MongoDB storage                Response policy
                              │                              │                              │
                              └──────────────────────────────┴──────────────► React dashboard
```

## technology

| Area | Tools |
| --- | --- |
| Backend | Python, FastAPI, Uvicorn |
| Machine learning | scikit-learn, pandas, NumPy, imbalanced-learn, joblib |
| Capture agent | Scapy |
| Database | MongoDB with Motor |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Recharts |
| Deployment | Docker and Docker Compose |

## quick-start-with-docker

This starts MongoDB, the FastAPI service, and the dashboard for local development.

```bash
git clone https://github.com/X0NepTon/NetSentryX.git
cd NetSentryX
docker compose up --build
```

Open the dashboard at [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:8000](http://localhost:8000), and its interactive documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

Stop the local stack with:

```bash
docker compose down
```

## local-setup  

### 1. Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the repository root. Start from the configuration example below, then run the API:

```bash
uvicorn api.app:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Dashboard

```bash
cd dashboard
npm ci
npm run dev
```

The dashboard is served at [http://localhost:5173](http://localhost:5173).

### 3. Optional capture agent

Run the capture agent only on a host and interface you are authorised to monitor.

```bash
INTERFACE=eth0 API_URL=http://127.0.0.1:8000/detect ./start_capture.sh
```

The script supports `INTERFACE`, `WINDOW`, `STEP`, `BPF`, and `API_URL` environment variables. Packet capture needs elevated permissions on Linux.

## configuration

Create `.env` locally. Never commit it.

```dotenv
MONGO_URI=mongodb://localhost:27017
IDS_DB=idsdb
MODEL_THRESHOLD=0.7
BLOCK_DURATION_SEC=600
ADMIN_API_KEY=replace-with-a-long-local-secret
USE_REAL_BLOCKING=false
```

For the dashboard, use `dashboard/.env.local` when you need a different API URL or an administrator token:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
VITE_ADMIN_TOKEN=replace-with-the-admin-api-key
```

## Dashboard

The frontend includes:

- Overview cards, live activity, and a network monitor.
- Alert and blocking history with incident details.
- Attack trends, attack-type distribution, and geographic context.
- Manual response controls, whitelist management, and IP reputation indicators.
- Daily reports, reporting views, model centre, playbooks, and a demo lab.

Build the production frontend with:

```bash
cd dashboard
npm run build
```

## api-reference

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/status` | Service and model status |
| `POST` | `/detect` | Submit a flow for classification |
| `GET` | `/alerts/recent` | Recent security alerts |
| `GET` | `/blocked` | Active blocked IPs |
| `GET` | `/blocked/history` | Previous blocking events |
| `GET`, `POST`, `DELETE` | `/whitelist` | Manage trusted IPs |
| `POST`, `DELETE` | `/admin/block` | Manual block controls |
| `GET`, `POST` | `/admin/config` | Detection policy settings |
| `GET` | `/admin/export_flows` | Export stored flows |
| `GET` | `/production_data/*` | Review, label, and export retraining data |

Open `/docs` while the API is running for request schemas and interactive testing.

## project-structure

```text
NetSentryX/
├── api/                 # FastAPI application and admin/data tools
├── dashboard/           # React + TypeScript dashboard
├── realtime_agent/      # Capture, aggregation, and API submission tools
├── models/              # Training and data-export scripts
├── data/                # Small local datasets and generated exports
├── test/                # Manual and scripted verification tools
├── docker-compose.yml   # Local multi-service environment
├── RUNBOOK.md           # Operating guide and endpoint notes
└── PROJECT_STRUCTURE.md # Detailed module map
```

## model-training

The training scripts use the CIC-IDS2017 dataset. Download the dataset separately and place its CSV files in `data/cic_raw/`; the folder is excluded from Git because it is large.

```bash
python models/train.py
```

For production-data workflows, review and label exported samples before retraining. Keep datasets containing real traffic outside the public repository unless they are anonymised and approved for sharing.

## safety-notes

- `USE_REAL_BLOCKING=false` is the safe development setting. Test response actions in an isolated lab before enabling operating-system firewall changes.
- Set `ADMIN_API_KEY` before exposing administrator endpoints outside a local development environment.
- Restrict the FastAPI CORS policy to the deployed dashboard origin before production use.
- Do not commit `.env` files, production captures, database dumps, tokens, or personal data.

## documentation

- [Runbook](RUNBOOK.md)
- [Project structure](PROJECT_STRUCTURE.md)
- [Test guide](test/README.md)

## Acknowledgements

- [CIC-IDS2017](https://www.unb.ca/cic/datasets/ids-2017.html) dataset
- [FastAPI](https://fastapi.tiangolo.com/)
- [scikit-learn](https://scikit-learn.org/)
- [Scapy](https://scapy.net/)
