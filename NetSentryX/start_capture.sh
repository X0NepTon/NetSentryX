#!/usr/bin/env bash
set -e
# Start IDS Packet Capture - portable version

# Resolve project directory (script directory by default). You can override
# by setting NETSENTRYX_PROJECT_DIR environment variable.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${NETSENTRYX_PROJECT_DIR:-$SCRIPT_DIR}"

cd "$PROJECT_DIR"

# Activate virtual environment if present (optional)
if [ -f ".venv/bin/activate" ]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
else
  echo "Warning: .venv not found. Continuing with system Python."
fi

# Defaults (can be overridden via env vars)
INTERFACE="${INTERFACE:-eth0}"
WINDOW="${WINDOW:-5}"
STEP="${STEP:-1}"
BPF="${BPF:-ip}"
API_URL="${API_URL:-http://127.0.0.1:8000/detect}"

echo "Starting IDS Packet Capture..."
echo "Project dir: $PROJECT_DIR"
echo "Interface: $INTERFACE"
echo "Window: $WINDOW sec, Step: $STEP sec"
echo "BPF: $BPF"
echo "API: $API_URL"
echo "Press Ctrl+C to stop"
echo ""

# Prefer python3 if available
PYTHON_CMD="$(which python3 2>/dev/null || which python 2>/dev/null)"
if [ -z "$PYTHON_CMD" ]; then
  echo "Error: python3 not found in PATH. Install Python 3 and try again." >&2
  exit 2
fi

sudo "$PYTHON_CMD" realtime_agent/realtime_extractor.py \
  --mode live \
  --iface "$INTERFACE" \
  --window "$WINDOW" \
  --step "$STEP" \
  --post \
  --api-url "$API_URL" \
  --bpf "$BPF"
