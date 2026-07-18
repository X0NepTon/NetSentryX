#!/usr/bin/env python3
"""
Quick Attack Test - Run all 5 attack patterns automatically
"""

import requests
import time

API_BASE = "http://127.0.0.1:8000"

attacks = [
    {
        "name": "Benign Traffic",
        "payload": {
            "src_ip": "192.168.1.100",
            "total_packets": 10,
            "total_bytes": 1500,
            "duration": 1.0,
            "pkts_per_sec": 10,
            "bytes_per_sec": 1500,
            "syn_count": 1,
            "unique_dst_ports": 1
        }
    },
    {
        "name": "Port Scan",
        "payload": {
            "src_ip": "10.0.0.50",
            "total_packets": 500,
            "total_bytes": 25000,
            "duration": 2.0,
            "pkts_per_sec": 250,
            "bytes_per_sec": 12500,
            "syn_count": 450,
            "unique_dst_ports": 400
        }
    },
    {
        "name": "DDoS Attack",
        "payload": {
            "src_ip": "10.0.0.66",
            "total_packets": 10000,
            "total_bytes": 2000000,
            "duration": 1.0,
            "pkts_per_sec": 10000,
            "bytes_per_sec": 2000000,
            "syn_count": 5000,
            "unique_dst_ports": 1
        }
    },
    {
        "name": "SYN Flood",
        "payload": {
            "src_ip": "10.0.0.77",
            "total_packets": 1000,
            "total_bytes": 60000,
            "duration": 0.5,
            "pkts_per_sec": 2000,
            "bytes_per_sec": 120000,
            "syn_count": 900,
            "unique_dst_ports": 1
        }
    },
    {
        "name": "Brute Force",
        "payload": {
            "src_ip": "10.0.0.99",
            "total_packets": 5000,
            "total_bytes": 500000,
            "duration": 30.0,
            "pkts_per_sec": 166,
            "bytes_per_sec": 16666,
            "syn_count": 2500,
            "unique_dst_ports": 2
        }
    }
]

print("=" * 60)
print("QUICK ATTACK TEST")
print("=" * 60)

# Lower threshold for demo
print("\n⚙️  Lowering threshold to 0.25 for demo...")
try:
    requests.post(f"{API_BASE}/admin/config", 
                  json={"threshold": 0.25, "block_duration_sec": 300},
                  timeout=5)
    print("✅ Threshold set to 0.25\n")
except Exception as e:
    print(f"⚠️  Could not set threshold: {e}\n")

# Run tests
results = []
for attack in attacks:
    print(f"Testing: {attack['name']}...")
    try:
        resp = requests.post(f"{API_BASE}/detect", json=attack['payload'], timeout=5)
        result = resp.json()
        
        status = "🚨 BLOCKED" if result.get('alert') else "✓ Allowed"
        score = result.get('score', 0)
        print(f"  {status} (score: {score:.4f})")
        
        results.append({
            'name': attack['name'],
            'score': score,
            'blocked': result.get('alert', False)
        })
    except Exception as e:
        print(f"  ❌ Error: {e}")
        results.append({'name': attack['name'], 'score': 0, 'blocked': False})
    
    time.sleep(1)

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
blocked_count = sum(1 for r in results if r['blocked'])
print(f"Total tests: {len(results)}")
print(f"Attacks blocked: {blocked_count}")
print(f"Traffic allowed: {len(results) - blocked_count}\n")

for r in results:
    status = "🚨 BLOCKED" if r['blocked'] else "✓ Allowed"
    print(f"  {r['name']:15} {status:12} (score: {r['score']:.4f})")

print("\n✅ Test complete!")
print(f"View blocked IPs: curl http://127.0.0.1:8000/blocked")
print(f"View alerts: curl http://127.0.0.1:8000/alerts/recent?limit=10")
