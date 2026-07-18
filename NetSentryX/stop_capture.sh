#!/bin/bash
# Stop IDS Packet Capture

echo "Stopping IDS packet capture..."
sudo pkill -f "realtime_extractor.py"

if [ $? -eq 0 ]; then
    echo "✓ Packet capture stopped successfully"
else
    echo "✗ No packet capture process found"
fi
