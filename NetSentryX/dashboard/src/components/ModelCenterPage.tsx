import React from "react";
import {
  getAlertScore,
  isAlertAttack,
  type AlertDoc,
  type BlockDoc,
  type ConfigDoc,
  type SystemStatus,
} from "../api";

export default function ModelCenterPage({
  alerts,
  blocked,
  config,
  status,
}: {
  alerts: AlertDoc[];
  blocked: BlockDoc[];
  config: ConfigDoc | null;
  status: SystemStatus | null;
}) {
  const attackAlerts = alerts.filter(isAlertAttack);
  const avgScore = alerts.length
    ? alerts.reduce((sum, alert) => sum + getAlertScore(alert), 0) / alerts.length
    : 0;

  const highConfidence = attackAlerts.filter((alert) => getAlertScore(alert) >= 0.75).length;
  const benign = alerts.length - attackAlerts.length;
  const threshold = config?.threshold ?? 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Model Center</h1>
        <p className="mt-1 text-sm text-slate-500">
          Detection model status, decision policy, and current prediction metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Model Status</p>
          <p className={`mt-2 text-2xl font-bold ${status?.model_loaded ? "text-emerald-400" : "text-rose-400"}`}>
            {status?.model_loaded ? "Loaded" : "Unknown"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Threshold</p>
          <p className="mt-2 text-2xl font-bold text-sky-400">{threshold.toFixed(2)}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Avg Score</p>
          <p className="mt-2 text-2xl font-bold text-purple-400">{avgScore.toFixed(3)}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Blocking</p>
          <p className={`mt-2 text-2xl font-bold ${config?.blocking_enabled !== false ? "text-emerald-400" : "text-slate-400"}`}>
            {config?.blocking_enabled !== false ? "Enabled" : "Disabled"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="font-bold text-slate-100">Model Summary</h2>

          <div className="mt-4 space-y-3">
            {[
              ["Model Type", "RandomForest Classifier"],
              ["Feature Set", "Packets, bytes, duration, rates, SYN count, unique ports"],
              ["Training Dataset", "CIC-IDS2017 + production flows"],
              ["Current Window Alerts", String(alerts.length)],
              ["Detected Attacks", String(attackAlerts.length)],
              ["Benign Predictions", String(benign)],
              ["High Confidence Attacks", String(highConfidence)],
              ["Currently Blocked", String(blocked.length)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-slate-950/50 p-3 text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold text-slate-100">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="font-bold text-slate-100">Decision Logic</h2>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-slate-200">Prediction score</p>
              <p className="mt-2 text-sm text-slate-400">
                The model returns a score. If the score is greater than or equal to the configured threshold, NetSentryX creates an alert and can block the source IP.
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-slate-200">Severity levels</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded bg-red-500/10 px-2 py-2 text-red-300">Critical ≥ 0.85</span>
                <span className="rounded bg-orange-500/10 px-2 py-2 text-orange-300">High ≥ 0.60</span>
                <span className="rounded bg-amber-500/10 px-2 py-2 text-amber-300">Medium ≥ 0.35</span>
                <span className="rounded bg-emerald-500/10 px-2 py-2 text-emerald-300">Low &lt; 0.35</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-slate-200">Live capture</p>
              <p className="mt-2 text-sm text-slate-400">
                Capture status: <span className="text-slate-200">{status?.live_capture_active ? "Active" : "Idle"}</span>. Last minute flows: <span className="text-slate-200">{status?.flows_last_minute ?? 0}</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
