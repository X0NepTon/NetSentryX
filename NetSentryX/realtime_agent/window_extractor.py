# realtime_agent/window_extractor.py
"""
Windowed feature extractor.
Reads a PCAP (offline) and produces sliding-window per-src feature vectors.
Usage:
  python realtime_agent/window_extractor.py data/sample.pcap --window 5 --step 1
Outputs printed JSON lines (one per src per window). You can change to POST to API.
"""

import argparse
from scapy.all import rdpcap, IP, TCP, UDP
from collections import defaultdict, deque
import time, json
from datetime import datetime

def extract_windows(pkts, window_size=5.0, step=1.0):
    """
    pkts: list of scapy packets (ordered)
    window_size: seconds
    step: seconds
    yields: (window_center_ts, src_ip, features_dict)
    """
    # Convert packets to simple events: (ts, src, len, dst_port, is_syn)
    events = []
    for p in pkts:
        if IP not in p:
            continue
        ts = float(p.time)
        src = p[IP].src
        size = len(p)
        dport = None
        is_syn = 0
        if p.haslayer(TCP):
            dport = int(p[TCP].dport)
            flags = p[TCP].flags
            if flags & 0x02:
                is_syn = 1
        elif p.haslayer(UDP):
            try:
                dport = int(p[UDP].dport)
            except Exception:
                dport = None
        events.append((ts, src, size, dport, is_syn))

    if not events:
        return

    # sort by ts (should already be sorted)
    events.sort(key=lambda e: e[0])

    t_start = events[0][0]
    t_end = events[-1][0]

    # sliding windows from t_start to t_end
    window_start = t_start
    while window_start <= t_end:
        window_end = window_start + window_size
        # gather events in window
        per_src = defaultdict(lambda: {"total_packets":0, "total_bytes":0, "syn_count":0, "dst_ports": set(), "first_ts": None, "last_ts": None})
        # We can binary-search to accelerate; for now simple linear scan (fine for small pcaps)
        for ts, src, size, dport, is_syn in events:
            if ts < window_start or ts >= window_end:
                continue
            v = per_src[src]
            v["total_packets"] += 1
            v["total_bytes"] += size
            v["syn_count"] += is_syn
            if dport is not None:
                v["dst_ports"].add(dport)
            if v["first_ts"] is None or ts < v["first_ts"]:
                v["first_ts"] = ts
            if v["last_ts"] is None or ts > v["last_ts"]:
                v["last_ts"] = ts

        # emit features per src
        for src, v in per_src.items():
            duration = (v["last_ts"] - v["first_ts"]) if (v["first_ts"] and v["last_ts"]) else 0.0
            features = {
                "window_start": window_start,
                "window_end": window_end,
                "src_ip": src,
                "total_packets": v["total_packets"],
                "total_bytes": v["total_bytes"],
                "duration": duration,
                "pkts_per_sec": v["total_packets"] / window_size,
                "bytes_per_sec": v["total_bytes"] / window_size,
                "syn_count": v["syn_count"],
                "unique_dst_ports": len(v["dst_ports"])
            }
            yield (window_start + window_size/2.0, src, features)

        window_start += step

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pcap", help="pcap file path")
    parser.add_argument("--window", type=float, default=5.0, help="window size in seconds")
    parser.add_argument("--step", type=float, default=1.0, help="step (slide) in seconds")
    parser.add_argument("--post", action="store_true", help="POST features to API (127.0.0.1:8000/detect)")
    args = parser.parse_args()

    pkts = rdpcap(args.pcap)
    for center_ts, src, features in extract_windows(pkts, window_size=args.window, step=args.step):
        # print JSON line
        print(json.dumps(features))
        # optional: post to API
        if args.post:
            import requests
            try:
                r = requests.post("http://127.0.0.1:8000/detect", json=features, timeout=5)
                print("->", r.status_code, r.json())
            except Exception as e:
                print("POST failed:", e)

if __name__ == "__main__":
    main()
