import React from "react";
import {
  buildDemoAttackPayload,
  detectFlow,
  downloadCsv,
  formatLocalDateTime,
  getAlertScore,
  getSeverity,
  isAlertAttack,
  type AlertDoc,
  type DetectPreview,
} from "../api";

type DemoScenario = {
  id: string;
  title: string;
  description: string;
  tone: string;
  payload: Record<string, unknown>;
};

const scenarios: DemoScenario[] = [
  {
    id: "ddos",
    title: "DDoS-like Flow",
    description: "High packet and byte rate with repeated SYN activity.",
    tone: "rose",
    payload: buildDemoAttackPayload("10.0.0.90"),
  },
  {
    id: "port-scan",
    title: "Port Scan Flow",
    description: "Many destination ports in a short flow window.",
    tone: "amber",
    payload: {
      src_ip: "10.0.0.91",
      total_packets: 220,
      total_bytes: 28000,
      duration: 1,
      pkts_per_sec: 220,
      bytes_per_sec: 28000,
      syn_count: 140,
      unique_dst_ports: 80,
    },
  },
  {
    id: "bruteforce",
    title: "Brute Force-like Flow",
    description: "Repeated short requests with a raised packet rate.",
    tone: "purple",
    payload: {
      src_ip: "10.0.0.92",
      total_packets: 350,
      total_bytes: 65000,
      duration: 2,
      pkts_per_sec: 175,
      bytes_per_sec: 32500,
      syn_count: 35,
      unique_dst_ports: 2,
    },
  },
  {
    id: "benign",
    title: "Benign Flow",
    description: "Small normal flow used to prove false positives stay low.",
    tone: "emerald",
    payload: {
      src_ip: "10.0.0.93",
      total_packets: 8,
      total_bytes: 4200,
      duration: 5,
      pkts_per_sec: 1.6,
      bytes_per_sec: 840,
      syn_count: 1,
      unique_dst_ports: 2,
    },
  },
];

function toneClasses(tone: string) {
  const map: Record<string, string> = {
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  };

  return map[tone] || map.rose;
}

function payloadToCurl(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload, null, 2).replace(/'/g, "'\\''");

  return `curl -X POST http://127.0.0.1:8000/detect \\
  -H "Content-Type: application/json" \\
  -d '${body}'`;
}

export default function DemoLabPage({
  alerts,
  onRefresh,
}: {
  alerts: AlertDoc[];
  onRefresh?: () => Promise<void>;
}) {
  const [runningId, setRunningId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<DetectPreview | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const attacks = alerts.filter(isAlertAttack);
  const latestDemo = alerts.find((alert) => alert.src_ip?.startsWith("10.0.0.9"));

  async function runScenario(scenario: DemoScenario) {
    setError(null);
    setRunningId(scenario.id);

    try {
      const res = await detectFlow(scenario.payload);
      setResult(res);
      await onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  }

  async function copyCurl(scenario: DemoScenario) {
    await navigator.clipboard.writeText(payloadToCurl(scenario.payload));
    setCopiedId(scenario.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  function exportDemoRows() {
    const rows = alerts
      .filter((alert) => alert.src_ip?.startsWith("10.0.0.9"))
      .map((alert) => ({
        time: formatLocalDateTime(alert.detected_at),
        src_ip: alert.src_ip,
        attack: isAlertAttack(alert),
        attack_type: alert.attack_type || "Unknown",
        score: getAlertScore(alert),
        severity: getSeverity(getAlertScore(alert)),
        blocked: alert.blocked ? "yes" : "no",
      }));

    downloadCsv("netsentryx-demo-lab.csv", rows);
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Demo Lab</h1>
          <p className="mt-1 text-sm text-slate-500">
            Run safe demo flows against the detection API without generating real attacks.
          </p>
        </div>

        <button
          onClick={exportDemoRows}
          className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-sky-500/50 hover:text-sky-300"
        >
          Export Demo CSV
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={`rounded-xl border p-5 shadow-xl ${toneClasses(scenario.tone)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-100">{scenario.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {scenario.description}
                </p>
              </div>
              <span className="rounded-full bg-slate-950/50 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300">
                Safe
              </span>
            </div>

            <div className="mt-4 rounded-lg bg-slate-950/50 p-3 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Source</span>
                <span className="font-mono text-slate-200">{String(scenario.payload.src_ip)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span>Packets/sec</span>
                <span className="font-mono text-slate-200">{String(scenario.payload.pkts_per_sec)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span>SYN count</span>
                <span className="font-mono text-slate-200">{String(scenario.payload.syn_count)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => runScenario(scenario)}
                disabled={runningId === scenario.id}
                className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningId === scenario.id ? "Running..." : "Run"}
              </button>
              <button
                onClick={() => copyCurl(scenario)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >
                {copiedId === scenario.id ? "Copied" : "Curl"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Demo Result</p>
          {result ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Alert</span>
                <span className={result.alert ? "font-bold text-rose-400" : "font-bold text-emerald-400"}>
                  {result.alert ? "Detected" : "Benign"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Score</span>
                <span className="font-mono text-slate-100">{Number(result.score || 0).toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Threshold</span>
                <span className="font-mono text-slate-100">{Number(result.threshold || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Blocked</span>
                <span className={result.blocked ? "text-amber-400" : "text-slate-400"}>
                  {result.blocked ? "Yes" : "No"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Run a scenario to see the detection response.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Window</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">Alerts</p>
              <p className="text-2xl font-bold text-slate-100">{alerts.length}</p>
            </div>
            <div className="rounded-lg bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">Attacks</p>
              <p className="text-2xl font-bold text-rose-400">{attacks.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Latest Demo Event</p>
          {latestDemo ? (
            <div className="mt-3 text-sm">
              <p className="font-mono text-sky-300">{latestDemo.src_ip}</p>
              <p className="mt-1 text-slate-400">{latestDemo.attack_type || "Unknown"}</p>
              <p className="mt-1 text-slate-500">{formatLocalDateTime(latestDemo.detected_at)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No demo events yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
