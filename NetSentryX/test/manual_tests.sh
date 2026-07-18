#!/bin/bash
# Manual cURL Tests for IDS
# Run each command individually to test different attack patterns

API="http://127.0.0.1:8000"

echo "==================================="
echo "IDS MANUAL TESTING COMMANDS"
echo "==================================="

echo -e "\n📋 Available Tests:\n"

echo "1️⃣  Benign Traffic (should be allowed):"
echo 'curl -X POST '"$API"'/detect -H "Content-Type: application/json" -d '"'"'{
  "src_ip": "192.168.1.100",
  "total_packets": 10,
  "total_bytes": 1500,
  "duration": 1.0,
  "pkts_per_sec": 10,
  "bytes_per_sec": 1500,
  "syn_count": 1,
  "unique_dst_ports": 1
}'"'"''
echo ""

echo "2️⃣  Port Scan Attack:"
echo 'curl -X POST '"$API"'/detect -H "Content-Type: application/json" -d '"'"'{
  "src_ip": "10.0.0.50",
  "total_packets": 500,
  "total_bytes": 25000,
  "duration": 2.0,
  "pkts_per_sec": 250,
  "bytes_per_sec": 12500,
  "syn_count": 450,
  "unique_dst_ports": 400
}'"'"''
echo ""

echo "3️⃣  DDoS Flood Attack:"
echo 'curl -X POST '"$API"'/detect -H "Content-Type: application/json" -d '"'"'{
  "src_ip": "10.0.0.66",
  "total_packets": 10000,
  "total_bytes": 2000000,
  "duration": 1.0,
  "pkts_per_sec": 10000,
  "bytes_per_sec": 2000000,
  "syn_count": 5000,
  "unique_dst_ports": 1
}'"'"''
echo ""

echo "4️⃣  SYN Flood Attack:"
echo 'curl -X POST '"$API"'/detect -H "Content-Type: application/json" -d '"'"'{
  "src_ip": "10.0.0.77",
  "total_packets": 1000,
  "total_bytes": 60000,
  "duration": 0.5,
  "pkts_per_sec": 2000,
  "bytes_per_sec": 120000,
  "syn_count": 900,
  "unique_dst_ports": 1
}'"'"''
echo ""

echo "5️⃣  Brute Force Attack:"
echo 'curl -X POST '"$API"'/detect -H "Content-Type: application/json" -d '"'"'{
  "src_ip": "10.0.0.99",
  "total_packets": 5000,
  "total_bytes": 500000,
  "duration": 30.0,
  "pkts_per_sec": 166,
  "bytes_per_sec": 16666,
  "syn_count": 2500,
  "unique_dst_ports": 2
}'"'"''
echo ""

echo -e "\n⚙️  Configuration Commands:\n"

echo "Lower threshold (0.25 - for demos):"
echo 'curl -X POST '"$API"'/admin/config -H "Content-Type: application/json" -d '"'"'{"threshold": 0.25, "block_duration_sec": 300}'"'"''
echo ""

echo "Reset threshold (0.70 - default):"
echo 'curl -X POST '"$API"'/admin/config -H "Content-Type: application/json" -d '"'"'{"threshold": 0.70, "block_duration_sec": 300}'"'"''
echo ""

echo -e "\n📊 Check Results:\n"

echo "View blocked IPs:"
echo "curl $API/blocked"
echo ""

echo "View recent alerts:"
echo "curl '$API/alerts/recent?limit=10'"
echo ""

echo "System status:"
echo "curl $API/status"
echo ""

echo "==================================="
