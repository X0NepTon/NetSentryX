# models/generate_synthetic_data.py
"""
Generate a small synthetic dataset of "flow/window" features for training.
Each row has:
- total_packets, total_bytes, duration, pkts_per_sec, bytes_per_sec, syn_count, unique_dst_ports, label
label: 0 = benign, 1 = attack
This is synthetic and only for learning/testing the pipeline.
"""
import csv
import random
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_flows.csv")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

FIELDNAMES = ["total_packets","total_bytes","duration","pkts_per_sec","bytes_per_sec","syn_count","unique_dst_ports","label"]

def make_benign():
    # benign flows: modest packet rates, few syns, few ports
    total_packets = random.randint(1, 50)
    total_bytes = total_packets * random.randint(40, 120)
    duration = random.uniform(0.5, 60.0)  # seconds
    pkts_per_sec = total_packets / duration
    bytes_per_sec = total_bytes / duration
    syn_count = random.randint(0, 2)
    unique_dst_ports = random.randint(1, 3)
    return [total_packets,total_bytes,duration,pkts_per_sec,bytes_per_sec,syn_count,unique_dst_ports,0]

def make_attack():
    # attack flows: high rates OR high syns OR many ports
    # Randomly choose type
    typ = random.choice(["ddos","syn_flood","port_scan"])
    if typ == "ddos":
        total_packets = random.randint(500, 5000)
        total_bytes = total_packets * random.randint(40, 150)
        duration = random.uniform(0.5, 10.0)
        syn_count = random.randint(0, 10)
        unique_dst_ports = random.randint(1, 5)
    elif typ == "syn_flood":
        total_packets = random.randint(200, 2000)
        total_bytes = total_packets * random.randint(40, 80)
        duration = random.uniform(0.1, 5.0)
        syn_count = random.randint(50, 500)
        unique_dst_ports = random.randint(1, 3)
    else:  # port_scan
        total_packets = random.randint(50, 600)
        total_bytes = total_packets * random.randint(40, 120)
        duration = random.uniform(0.5, 20.0)
        syn_count = random.randint(5, 50)
        unique_dst_ports = random.randint(20, 200)
    pkts_per_sec = total_packets / max(duration, 0.0001)
    bytes_per_sec = total_bytes / max(duration, 0.0001)
    return [total_packets,total_bytes,duration,pkts_per_sec,bytes_per_sec,syn_count,unique_dst_ports,1]

def generate(n_benign=800, n_attack=200):
    rows = []
    for _ in range(n_benign):
        rows.append(make_benign())
    for _ in range(n_attack):
        rows.append(make_attack())
    random.shuffle(rows)
    with open(OUT, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(FIELDNAMES)
        writer.writerows(rows)
    print("[+] Wrote", OUT, "rows:", len(rows))

if __name__ == "__main__":
    generate()
