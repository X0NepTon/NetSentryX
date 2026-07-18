# realtime_agent/generate_sample_pcap.py
from scapy.all import Ether, IP, TCP, UDP, wrpcap
import sys
import os

def make_packets():
    pkts = []
    # TCP exchange between two hosts
    for i in range(3):
        pkts.append(Ether()/IP(src="10.0.0.1", dst="10.0.0.2")/
                    TCP(sport=1234+i, dport=80, flags="S")/
                    ("GET /%d" % i))
    for i in range(3):
        pkts.append(Ether()/IP(src="10.0.0.2", dst="10.0.0.1")/
                    TCP(sport=80, dport=1234+i, flags="SA")/
                    ("HTTP/200 OK"))
    # some UDP traffic
    for i in range(5):
        pkts.append(Ether()/IP(src="10.0.0.3", dst="10.0.0.4")/
                    UDP(sport=5000+i, dport=53)/
                    ("payload%d" % i))
    return pkts

if __name__ == "__main__":
    # compute project root relative to this script file
    script_dir = os.path.dirname(os.path.abspath(__file__))      # .../ids-project/realtime_agent
    project_root = os.path.abspath(os.path.join(script_dir, ".."))  # .../ids-project
    default_out = os.path.join(project_root, "data", "sample.pcap")

    out = sys.argv[1] if len(sys.argv) > 1 else default_out

    # ensure containing folder exists
    out_dir = os.path.dirname(out)
    os.makedirs(out_dir, exist_ok=True)

    pkts = make_packets()
    wrpcap(out, pkts)
    print("Wrote", len(pkts), "packets to", out)

