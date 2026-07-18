#!/usr/bin/env python3
"""
Interactive Attack Testing Tool
Easy-to-use script for testing IDS with different attack patterns
"""

import requests
import json
import time
from datetime import datetime

API_BASE = "http://127.0.0.1:8000"

def print_banner():
    print("\n" + "="*60)
    print("     IDS ATTACK TESTING TOOL")
    print("="*60)

def print_menu():
    print("\n📋 Available Tests:")
    print("  1. Benign Traffic (Normal web browsing)")
    print("  2. Port Scan Attack")
    print("  3. DDoS Flood Attack")
    print("  4. SYN Flood Attack")
    print("  5. Brute Force Attack")
    print("  6. Run All Tests")
    print("  7. Check Alerts")
    print("  8. Check Blocked IPs")
    print("  9. Lower Threshold (0.25 - easier to detect)")
    print(" 10. Reset Threshold (0.70 - default)")
    print("  0. Exit")

def send_flow(name, payload):
    print(f"\n🔬 Testing: {name}")
    print(f"   Source IP: {payload['src_ip']}")
    
    try:
        resp = requests.post(f"{API_BASE}/detect", json=payload, timeout=5)
        result = resp.json()
        
        if result.get('alert'):
            print(f"   🚨 ATTACK DETECTED!")
            print(f"   Score: {result['score']:.4f}")
            print(f"   Threshold: {result['threshold']}")
            print(f"   ⚠️  IP will be BLOCKED")
        else:
            print(f"   ✅ Allowed (benign)")
            print(f"   Score: {result['score']:.4f}")
            print(f"   Threshold: {result['threshold']}")
        
        return result
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None

def test_benign():
    payload = {
        "src_ip": "192.168.1.100",
        "total_packets": 10,
        "total_bytes": 1500,
        "duration": 1.0,
        "pkts_per_sec": 10,
        "bytes_per_sec": 1500,
        "syn_count": 1,
        "unique_dst_ports": 1
    }
    return send_flow("Benign Traffic", payload)

def test_port_scan():
    payload = {
        "src_ip": "10.0.0.50",
        "total_packets": 500,
        "total_bytes": 25000,
        "duration": 2.0,
        "pkts_per_sec": 250,
        "bytes_per_sec": 12500,
        "syn_count": 450,
        "unique_dst_ports": 400
    }
    return send_flow("Port Scan Attack", payload)

def test_ddos():
    payload = {
        "src_ip": "10.0.0.66",
        "total_packets": 10000,
        "total_bytes": 2000000,
        "duration": 1.0,
        "pkts_per_sec": 10000,
        "bytes_per_sec": 2000000,
        "syn_count": 5000,
        "unique_dst_ports": 1
    }
    return send_flow("DDoS Flood", payload)

def test_syn_flood():
    payload = {
        "src_ip": "10.0.0.77",
        "total_packets": 1000,
        "total_bytes": 60000,
        "duration": 0.5,
        "pkts_per_sec": 2000,
        "bytes_per_sec": 120000,
        "syn_count": 900,
        "unique_dst_ports": 1
    }
    return send_flow("SYN Flood", payload)

def test_brute_force():
    payload = {
        "src_ip": "10.0.0.99",
        "total_packets": 5000,
        "total_bytes": 500000,
        "duration": 30.0,
        "pkts_per_sec": 166,
        "bytes_per_sec": 16666,
        "syn_count": 2500,
        "unique_dst_ports": 2
    }
    return send_flow("Brute Force Attack", payload)

def check_alerts():
    print("\n📊 Recent Alerts:")
    try:
        resp = requests.get(f"{API_BASE}/alerts/recent?limit=10", timeout=5)
        alerts = resp.json()
        
        if not alerts:
            print("   No alerts found")
            return
        
        print(f"   Total: {len(alerts)}\n")
        for i, alert in enumerate(alerts[:5], 1):
            status = "🚨 ATTACK" if alert['attack'] else "✓ BENIGN"
            print(f"   {i}. {status}")
            print(f"      IP: {alert['src_ip']}")
            print(f"      Score: {alert['score']:.4f}")
            print(f"      Time: {alert['detected_at']}")
            print()
    except Exception as e:
        print(f"   ❌ Error: {e}")

def check_blocked():
    print("\n🔒 Blocked IPs:")
    try:
        resp = requests.get(f"{API_BASE}/blocked?limit=50", timeout=5)
        blocked = resp.json()
        
        if not blocked:
            print("   No IPs currently blocked")
            return
        
        print(f"   Total: {len(blocked)}\n")
        for i, entry in enumerate(blocked, 1):
            print(f"   {i}. IP: {entry['ip']}")
            print(f"      Blocked at: {entry['blocked_at']}")
            print(f"      Unblock at: {entry.get('unblock_at', 'N/A')}")
            print(f"      Reason: {entry.get('reason', 'N/A')}")
            print()
    except Exception as e:
        print(f"   ❌ Error: {e}")

def set_threshold(value):
    print(f"\n⚙️  Setting threshold to {value}...")
    try:
        payload = {"threshold": value, "block_duration_sec": 300}
        resp = requests.post(f"{API_BASE}/admin/config", json=payload, timeout=5)
        result = resp.json()
        print(f"   ✅ Threshold updated to {result['config']['threshold']}")
        print(f"   Block duration: {result['config']['block_duration_sec']}s")
    except Exception as e:
        print(f"   ❌ Error: {e}")

def run_all_tests():
    print("\n🔄 Running all attack tests...\n")
    
    tests = [
        ("Benign", test_benign),
        ("Port Scan", test_port_scan),
        ("DDoS", test_ddos),
        ("SYN Flood", test_syn_flood),
        ("Brute Force", test_brute_force)
    ]
    
    results = []
    for name, test_func in tests:
        result = test_func()
        if result:
            results.append((name, result))
        time.sleep(1)
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    attacks = sum(1 for _, r in results if r.get('alert'))
    print(f"Total tests: {len(results)}")
    print(f"Attacks detected: {attacks}")
    print(f"Benign allowed: {len(results) - attacks}")
    print()
    
    for name, result in results:
        status = "🚨 BLOCKED" if result.get('alert') else "✓ Allowed"
        print(f"  {name:15} {status:12} (score: {result.get('score', 0):.4f})")

def main():
    print_banner()
    
    # Check if API is running
    try:
        resp = requests.get(f"{API_BASE}/status", timeout=3)
        status = resp.json()
        print(f"\n✅ API Status: {status['status']}")
        print(f"   Live Capture: {'ON' if status['live_capture_active'] else 'OFF'}")
        print(f"   Model Loaded: {'Yes' if status['model_loaded'] else 'No'}")
    except:
        print("\n❌ Cannot connect to API at", API_BASE)
        print("   Make sure the API is running:")
        print("   uvicorn api.app:app --host 0.0.0.0 --port 8000")
        return
    
    while True:
        print_menu()
        choice = input("\n👉 Select option (0-10): ").strip()
        
        if choice == '0':
            print("\n✋ Goodbye!\n")
            break
        elif choice == '1':
            test_benign()
        elif choice == '2':
            test_port_scan()
        elif choice == '3':
            test_ddos()
        elif choice == '4':
            test_syn_flood()
        elif choice == '5':
            test_brute_force()
        elif choice == '6':
            run_all_tests()
        elif choice == '7':
            check_alerts()
        elif choice == '8':
            check_blocked()
        elif choice == '9':
            set_threshold(0.25)
        elif choice == '10':
            set_threshold(0.70)
        else:
            print("\n❌ Invalid choice. Please try again.")
        
        time.sleep(0.5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✋ Interrupted by user. Goodbye!\n")
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
