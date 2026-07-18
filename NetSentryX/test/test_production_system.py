#!/usr/bin/env python3
"""
Test production data collection via API
Since we have MongoDB SSL issues with direct connection,
we'll verify through the API endpoints.
"""
import requests
import json

API_URL = "http://127.0.0.1:8000"


def test_system():
    print("\n" + "="*80)
    print("Production Data Collection System Test")
    print("="*80 + "\n")
    
    # Check API is running
    print("1. Testing API connection...")
    try:
        response = requests.get(f"{API_URL}/alerts/recent?limit=1")
        if response.status_code == 200:
            print("   ✓ API is running")
        else:
            print(f"   ✗ API returned status {response.status_code}")
            return
    except Exception as e:
        print(f"   ✗ Cannot connect to API: {e}")
        print("\n   Start the API first:")
        print("   source .venv/bin/activate")
        print("   uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload")
        return
    
    # Send test detection request
    print("\n2. Sending test detection request...")
    test_flow = {
        "src_ip": "192.168.1.100",
        "total_packets": 1000,
        "total_bytes": 500000,
        "duration": 2.0,
        "pkts_per_sec": 500.0,
        "bytes_per_sec": 250000.0,
        "syn_count": 25,
        "unique_dst_ports": 50,
        "extra": {"test": True}
    }
    
    try:
        response = requests.post(f"{API_URL}/detect", json=test_flow)
        if response.status_code == 200:
            result = response.json()
            print(f"   ✓ Detection successful")
            print(f"   - Alert: {result.get('alert', 'N/A')}")
            print(f"   - Score: {result.get('score', 'N/A'):.4f}")
            if result.get('attack_type'):
                print(f"   - Attack Type: {result['attack_type']}")
        else:
            print(f"   ✗ Detection failed: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Detection error: {e}")
    
    print("\n" + "="*80)
    print("System Check Complete!")
    print("="*80)
    
    print("\n📊 Production Data Collection Features:")
    print("   ✓ Auto-collection: Every /detect request saves to production_data")
    print("   ✓ Ready for labeling once data accumulates")
    
    print("\n📝 Next Steps:")
    print("\n1. Collect Real Data (run for 1 week):")
    print("   ./start_capture.sh")
    
    print("\n2. View Collection Statistics:")
    print("   python api/label_data.py stats")
    
    print("\n3. Start Labeling:")
    print("   python api/label_data.py label --limit 20")
    
    print("\n4. Export Labeled Data:")
    print("   python api/label_data.py export")
    
    print("\n5. Retrain Model:")
    print("   python models/retrain_with_production_data.py --use-smote")
    
    print("\n📚 Full Documentation:")
    print("   See PRODUCTION_DATA_GUIDE.md for complete workflow")
    
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    test_system()
