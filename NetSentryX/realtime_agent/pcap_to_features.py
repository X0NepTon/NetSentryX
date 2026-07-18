# realtime_agent/pcap_to_features.py
"""
Read a PCAP and compute simple per-source-IP aggregation features:
- total_packets
- total_bytes
- first_ts, last_ts, duration
- pkts_per_sec, bytes_per_sec
- syn_count (TCP SYN flags)
- unique_dst_ports
Also prints a small table of per-src feature vectors.
Designed for offline PCAP -> feature extraction and learning.
"""

from scapy.all import rdpcap, TCP, IP
from collections import defaultdict
import sys

PCAP_PATH = sys.argv[1] if len(sys.argv) > 1 else "data/sample.pcap"

def analyze_pcap(path):
    print(f"[+] Reading PCAP: {path}")
    pkts = rdpcap(path)
    if len(pkts) == 0:
        print("[!] No packets in file.")
        return

    per_src = defaultdict(lambda: {
        "total_packets": 0,
        "total_bytes": 0,
        "first_ts": None,
        "last_ts": None,
        "syn_count": 0,
        "unique_dst_ports": set()
    })

    # iterate packets in capture order (Scapy preserves order)
    for pkt in pkts:
        ts = float(pkt.time)
        # Only consider IP packets for this example
        if IP not in pkt:
            continue
        src = pkt[IP].src
        dst = pkt[IP].dst
        size = len(pkt)  # length in bytes (wire length)
        per_src_entry = per_src[src]
        per_src_entry["total_packets"] += 1
        per_src_entry["total_bytes"] += size
        if per_src_entry["first_ts"] is None or ts < per_src_entry["first_ts"]:
            per_src_entry["first_ts"] = ts
        if per_src_entry["last_ts"] is None or ts > per_src_entry["last_ts"]:
            per_src_entry["last_ts"] = ts

        # TCP flags -> SYN detection
        if pkt.haslayer(TCP):
            flags = pkt[TCP].flags
            # TCP flag SYN is 0x02 — check presence
            if flags & 0x02:
                per_src_entry["syn_count"] += 1

        # destination port if TCP/UDP
        dport = None
        try:
            # scapy names: TCP.dport, UDP.dport
            if pkt.haslayer("TCP"):
                dport = pkt["TCP"].dport
            elif pkt.haslayer("UDP"):
                dport = pkt["UDP"].dport
        except Exception:
            dport = None

        if dport:
            per_src_entry["unique_dst_ports"].add(dport)

    # finalize features and print table
    print("\nPer-source summary:")
    header = ["src_ip","pkts","bytes","duration(s)","pkts/s","bytes/s","syns","unique_dst_ports_count"]
    print("{:<15} {:>6} {:>8} {:>12} {:>8} {:>10} {:>6} {:>6}".format(*header))
    for src, v in per_src.items():
        duration = 0.0
        if v["first_ts"] is not None and v["last_ts"] is not None:
            duration = max( v["last_ts"] - v["first_ts"], 0.000001)
        pkts_per_sec = v["total_packets"] / duration if duration>0 else v["total_packets"]
        bytes_per_sec = v["total_bytes"] / duration if duration>0 else v["total_bytes"]

        print("{:<15} {:>6} {:>8} {:>12.3f} {:>8.3f} {:>10.1f} {:>6} {:>6}".format(
            src,
            v["total_packets"],
            v["total_bytes"],
            duration,
            pkts_per_sec,
            bytes_per_sec,
            v["syn_count"],
            len(v["unique_dst_ports"])
        ))

    # Also return dict for programmatic use
    # Convert sets to counts
    out = {}
    for src, v in per_src.items():
        duration = 0.0
        if v["first_ts"] is not None and v["last_ts"] is not None:
            duration = max( v["last_ts"] - v["first_ts"], 0.000001)
        out[src] = {
            "total_packets": v["total_packets"],
            "total_bytes": v["total_bytes"],
            "duration": duration,
            "pkts_per_sec": v["total_packets"] / duration if duration>0 else v["total_packets"],
            "bytes_per_sec": v["total_bytes"] / duration if duration>0 else v["total_bytes"],
            "syn_count": v["syn_count"],
            "unique_dst_ports": len(v["unique_dst_ports"])
        }
    return out

if __name__ == "__main__":
    analyze_pcap(PCAP_PATH)
