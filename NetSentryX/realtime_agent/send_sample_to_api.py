# realtime_agent/send_sample_to_api.py
import requests, json
from realtime_agent.pcap_to_features import analyze_pcap

API = "http://127.0.0.1:8000/detect"
features = analyze_pcap("data/sample.pcap")  # returns a dict keyed by src_ip

for src, fv in features.items():
    payload = {
        "src_ip": src,
        "total_packets": fv["total_packets"],
        "total_bytes": fv["total_bytes"],
        "duration": fv["duration"],
        "pkts_per_sec": fv["pkts_per_sec"],
        "bytes_per_sec": fv["bytes_per_sec"],
        "syn_count": fv["syn_count"],
        "unique_dst_ports": fv["unique_dst_ports"]
    }
    print("Posting for", src, payload)
    try:
        r = requests.post(API, json=payload, timeout=3)
        print("->", r.status_code, r.json())
    except Exception as e:
        print("Request failed:", e)
