# realtime_agent/realtime_extractor.py
"""
Realtime / streaming window extractor.

Usage examples:
  python realtime_agent/realtime_extractor.py --mode replay --pcap data/sample.pcap --window 5 --step 1 --post
  python realtime_agent/realtime_extractor.py --mode replay --pcap data/sample.pcap --window 5 --step 1 --post --speed 10
    sudo python realtime_agent/realtime_extractor.py --mode live --iface eth0 --window 5 --step 1 --post --api-url http://127.0.0.1:8000/detect --bpf "tcp or udp"
"""

import argparse
import threading
import time
import json
import requests
from dataclasses import dataclass
from typing import Optional, Dict, Deque, List, Tuple
from collections import defaultdict, deque
from datetime import datetime, timezone
from scapy.all import rdpcap, IP, TCP, UDP, sniff, conf

# --- Config & helper types ---

FEATURE_KEYS = [
    "src_ip",
    "total_packets",
    "total_bytes",
    "duration",
    "pkts_per_sec",
    "bytes_per_sec",
    "syn_count",
    "unique_dst_ports",
]


@dataclass
class Event:
    ts: float
    src_ip: str
    dst_ip: Optional[str]
    size: int
    dport: Optional[int]
    proto: str
    is_syn: int
    is_ack: int
    is_rst: int
    is_fin: int

# Per-src buffer: deque of Event
buffers: Dict[str, Deque[Event]] = defaultdict(lambda: deque())

# Lock to protect buffers (sniffer thread -> aggregator thread)
buffers_lock = threading.Lock()

# Track last activity so we can drop stale srcs
last_activity = defaultdict(lambda: 0.0)

# Event to indicate replay finished
replay_done = threading.Event()

# --- Packet -> Event conversion helper ---
def packet_to_event(pkt) -> Optional[Event]:
    if IP not in pkt:
        return None
    ts = float(pkt.time)
    src = pkt[IP].src
    dst_ip = pkt[IP].dst
    size = len(pkt)
    dport = None
    is_syn = 0
    is_ack = 0
    is_rst = 0
    is_fin = 0
    proto = "OTHER"
    if pkt.haslayer(TCP):
        try:
            dport = int(pkt[TCP].dport)
            flags = pkt[TCP].flags
            if flags & 0x02:
                is_syn = 1
            if flags & 0x10:
                is_ack = 1
            if flags & 0x04:
                is_rst = 1
            if flags & 0x01:
                is_fin = 1
        except Exception:
            pass
        proto = "TCP"
    elif pkt.haslayer(UDP):
        try:
            dport = int(pkt[UDP].dport)
        except Exception:
            pass
        proto = "UDP"
    return Event(
        ts=ts,
        src_ip=src,
        dst_ip=dst_ip,
        size=size,
        dport=dport,
        proto=proto,
        is_syn=is_syn,
        is_ack=is_ack,
        is_rst=is_rst,
        is_fin=is_fin,
    )

# --- Sniffer callback (for live mode) or replay append (replay mode) ---
def push_event(event):
    if event is None:
        return
    ts = event.ts
    src = event.src_ip
    with buffers_lock:
        buffers[src].append(event)
        last_activity[src] = ts

# --- Live sniff thread (if requested) ---
def start_live_sniff(iface=None, bpf_filter=None):
    def _cb(pkt):
        ev = packet_to_event(pkt)
        push_event(ev)
    kwargs = {"prn": _cb, "store": False}
    if iface:
        kwargs["iface"] = iface
    if bpf_filter:
        kwargs["filter"] = bpf_filter
    try:
        sniff(**kwargs)
    except PermissionError:
        print("[sniff] Permission denied. Try running with sudo or elevated privileges.")
    except OSError as exc:
        print(f"[sniff] Error while sniffing: {exc}")

# --- Replay thread (reads pcap and replays with timing) ---
def start_replay(pcap_path, speed=1.0):
    try:
        pkts = rdpcap(pcap_path)
    except FileNotFoundError:
        print("[replay] pcap not found:", pcap_path)
        replay_done.set()
        return
    if not pkts:
        print("[replay] no packets in pcap", pcap_path)
        replay_done.set()
        return
    prev_ts = float(pkts[0].time)
    for p in pkts:
        cur_ts = float(p.time)
        wait = max(0.0, (cur_ts - prev_ts) / max(1.0, speed))
        time.sleep(wait)
        ev = packet_to_event(p)
        push_event(ev)
        prev_ts = cur_ts
    # mark replay finished
    replay_done.set()

# --- Aggregation: compute features for buffers within window ---
def compute_features_for_src(src, window_size):
    now = time.time()
    window_start = now - window_size
    with buffers_lock:
        dq = buffers.get(src)
        if not dq:
            return None
        # drop old events from left
        while dq and dq[0].ts < window_start:
            dq.popleft()
        if not dq:
            return None

        total_packets = 0
        total_bytes = 0
        syn_count = 0
        dst_ports = set()
        dst_ips = set()
        tcp_ack = 0
        tcp_rst = 0
        tcp_fin = 0
        proto_counts: Dict[str, int] = defaultdict(int)

        first_ts = None
        last_ts = None

        for ev in dq:
            total_packets += 1
            total_bytes += ev.size
            syn_count += ev.is_syn
            tcp_ack += ev.is_ack
            tcp_rst += ev.is_rst
            tcp_fin += ev.is_fin
            if ev.dport is not None:
                dst_ports.add(ev.dport)
            if ev.dst_ip:
                dst_ips.add(ev.dst_ip)
            proto_counts[ev.proto] += 1

            if first_ts is None or ev.ts < first_ts:
                first_ts = ev.ts
            if last_ts is None or ev.ts > last_ts:
                last_ts = ev.ts

        duration = 0.0
        if first_ts is not None and last_ts is not None:
            duration = max(last_ts - first_ts, 1e-6)
        else:
            duration = max(window_size, 1e-6)

        avg_pkt_size = (total_bytes / total_packets) if total_packets > 0 else 0.0
        pkts_per_sec = total_packets / duration if duration > 0 else 0.0
        bytes_per_sec = total_bytes / duration if duration > 0 else 0.0

        extras = {
            "window_start": window_start,
            "window_end": now,
            "avg_pkt_size": avg_pkt_size,
            "unique_dst_ips": len(dst_ips),
            "tcp_ack": tcp_ack,
            "tcp_rst": tcp_rst,
            "tcp_fin": tcp_fin,
            "proto_counts": dict(proto_counts),
        }

        features = {
            "src_ip": src,
            "total_packets": total_packets,
            "total_bytes": total_bytes,
            "duration": duration,
            "pkts_per_sec": pkts_per_sec,
            "bytes_per_sec": bytes_per_sec,
            "syn_count": syn_count,
            "unique_dst_ports": len(dst_ports) or 1,
            "extra": extras,
        }
        return features

# --- Poster: send features to API (synchronous requests by default) ---
def post_features_to_api(features_list, api_url="http://127.0.0.1:8000/detect", verify=True, headers=None):
    out = []
    for feat in features_list:
        try:
            payload = {key: feat[key] for key in FEATURE_KEYS if key in feat}
            payload.setdefault("extra", feat.get("extra", {}))
            r = requests.post(api_url, json=payload, timeout=5, verify=verify, headers=headers)
            # safe parse
            try:
                body = r.json()
            except Exception:
                body = r.text
            out.append((feat["src_ip"], r.status_code, body))
        except Exception as e:
            out.append((feat["src_ip"], None, str(e)))
    return out

# --- Main loop: periodic aggregation and optional posting ---
def start_aggregator(window_size=5.0, step=1.0, post=False, batch=1, keep_idle_for=60.0,
                     mode="replay", api_url="http://127.0.0.1:8000/detect", verify=True, headers=None):
    """
    Periodically (every `step`) compute features for each active src and optionally post them.
    The aggregator will exit automatically in replay mode when replay_done is set AND buffers empty.
    """
    print("[aggregator] starting: window_size=%s step=%s post=%s batch=%s mode=%s" % (
        window_size, step, post, batch, mode))
    try:
        while True:
            t0 = time.time()
            # snapshot active sources
            with buffers_lock:
                srcs = list(buffers.keys())
            features_batch = []
            for src in srcs:
                feat = compute_features_for_src(src, window_size)
                if feat:
                    features_batch.append(feat)
                # drop completely idle sources
                last_ts = last_activity.get(src, 0.0)
                if (time.time() - last_ts) > keep_idle_for:
                    with buffers_lock:
                        try:
                            del buffers[src]
                            del last_activity[src]
                        except KeyError:
                            pass
            # send in batches if requested
            if post and features_batch:
                for i in range(0, len(features_batch), batch):
                    chunk = features_batch[i:i+batch]
                    results = post_features_to_api(chunk, api_url=api_url, verify=verify, headers=headers)
                    for r in results:
                        print("[POST]", r)
            else:
                for f in features_batch:
                    print(json.dumps(f))
            # Check for replay termination condition:
            if mode == "replay" and replay_done.is_set():
                # If replay is done and no more buffered events (all deques empty), then exit
                with buffers_lock:
                    any_nonempty = any(len(dq) > 0 for dq in buffers.values())
                if not any_nonempty:
                    print("[aggregator] replay finished and buffers drained — exiting")
                    return
            # sleep until next step (adjust for time spent)
            elapsed = time.time() - t0
            to_sleep = max(0.0, step - elapsed)
            time.sleep(to_sleep)
    except KeyboardInterrupt:
        print("[aggregator] stopped by user")

# --- Command-line entrypoint ---
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["replay", "live"], default="replay")
    parser.add_argument("--pcap", default=None, help="pcap file for replay mode")
    parser.add_argument("--iface", default=None, help="interface for live mode (scapy.conf.iface if None)")
    parser.add_argument("--window", type=float, default=5.0)
    parser.add_argument("--step", type=float, default=1.0)
    parser.add_argument("--post", action="store_true")
    parser.add_argument("--batch", type=int, default=1, help="batch size for POST")
    parser.add_argument("--speed", type=float, default=1.0, help="replay speed multiplier")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000/detect", help="Detection endpoint URL")
    parser.add_argument("--idle-timeout", type=float, default=60.0,
                        help="Seconds to keep inactive sources before dropping state")
    parser.add_argument("--insecure", action="store_true",
                        help="Disable TLS verification when posting to HTTPS API URLs")
    parser.add_argument("--bpf", default=None,
                        help="Optional BPF filter for live sniffing (e.g. 'tcp or udp')")
    args = parser.parse_args()

    # clear replay flag
    replay_done.clear()

    verify = not args.insecure

    if args.mode == "live":
        iface = args.iface or conf.iface
        print("[main] starting live sniff on iface:", iface)
        th = threading.Thread(target=start_live_sniff, args=(iface, args.bpf), daemon=True)
        th.start()
        start_aggregator(
            window_size=args.window,
            step=args.step,
            post=args.post,
            batch=args.batch,
            mode="live",
            keep_idle_for=args.idle_timeout,
            api_url=args.api_url,
            verify=verify,
        )
    else:
        if not args.pcap:
            print("Replay mode requires --pcap PATH")
            return
        th = threading.Thread(target=start_replay, args=(args.pcap, args.speed), daemon=True)
        th.start()
        start_aggregator(
            window_size=args.window,
            step=args.step,
            post=args.post,
            batch=args.batch,
            mode="replay",
            keep_idle_for=args.idle_timeout,
            api_url=args.api_url,
            verify=verify,
        )

if __name__ == "__main__":
    main()
