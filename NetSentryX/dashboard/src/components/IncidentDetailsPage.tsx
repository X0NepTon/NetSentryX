import React from "react";
import {
  formatLocalDateTime,
  getAlertScore,
  getSeverity,
  isAlertAttack,
  type AlertDoc,
  type BlockDoc,
} from "../api";

function explainAlert(alert: AlertDoc) {
  const features = alert.features || {};
  const reasons: string[] = [];
  const packetsPerSec = Number(alert.pkts_per_sec ?? features.pkts_per_sec ?? 0);
  const bytesPerSec = Number(alert.bytes_per_sec ?? features.bytes_per_sec ?? 0);
  const synCount = Number(alert.syn_count ?? features.syn_count ?? 0);
  const ports = Number(alert.unique_dst_ports ?? features.unique_dst_ports ?? 0);
  const score = getAlertScore(alert);

  if (score >= 0.85) reasons.push("Very high model score.");
  if (packetsPerSec >= 150) reasons.push("High packets per second.");
  if (bytesPerSec >= 30000) reasons.push("High bytes per second.");
  if (synCount >= 20) reasons.push("Raised SYN count.");
  if (ports >= 20) reasons.push("Many destination ports.");
  if (!reasons.length) reasons.push("Score exceeded the configured threshold.");

  return reasons;
}

function featureRows(alert: AlertDoc) {
  const features = alert.features || {};
  return [
    ["Total packets", alert.total_packets ?? features.total_packets ?? 0],
    ["Total bytes", alert.total_bytes ?? features.total_bytes ?? 0],
    ["Duration", alert.duration ?? features.duration ?? 0],
    ["Packets/sec", alert.pkts_per_sec ?? features.pkts_per_sec ?? 0],
    ["Bytes/sec", alert.bytes_per_sec ?? features.bytes_per_sec ?? 0],
    ["SYN count", alert.syn_count ?? features.syn_count ?? 0],
    ["Unique destination ports", alert.unique_dst_ports ?? features.unique_dst_ports ?? 0],
  ];
}

export default function IncidentDetailsPage({
  alerts,
  blocked,
}: {
  alerts: AlertDoc[];
  blocked: BlockDoc[];
}) {
  const attackAlerts = alerts.filter(isAlertAttack);
  const [selectedId, setSelectedId] = React.useState<string>("");

  React.useEffect(() => {
    if (!selectedId && attackAlerts[0]) {
      setSelectedId(attackAlerts[0]._id || attackAlerts[0].id || "");
    }
  }, [attackAlerts, selectedId]);

  const selected =
    alerts.find((alert) => (alert._id || alert.id) === selectedId) ||
    attackAlerts[0] ||
    alerts[0];

  const selectedBlocked = selected
    ? blocked.find((entry) => entry.ip === selected.src_ip || entry.src_ip === selected.src_ip)
    : undefined;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Incident Details</h1>
        <p className="mt-1 text-sm text-slate-500">
          Inspect one alert, its evidence, response status, and recommended action.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="font-bold text-slate-100">Recent Incidents</h2>

          <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {alerts.length ? (
              alerts.map((alert) => {
                const id = alert._id || alert.id || `${alert.src_ip}-${alert.detected_at}`;
                const active = selected && id === (selected._id || selected.id);
                const severity = getSeverity(getAlertScore(alert));

                return (
                  <button
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-sky-500/50 bg-sky-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-sky-300">{alert.src_ip}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                        isAlertAttack(alert) ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                      }`}>
                        {isAlertAttack(alert) ? severity : "benign"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatLocalDateTime(alert.detected_at)}</p>
                    <p className="mt-1 text-xs text-slate-400">{alert.attack_type || "Unknown"}</p>
                  </button>
                );
              })
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No alerts found.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selected ? (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Selected Incident</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-100">{selected.src_ip}</h2>
                    <p className="mt-1 text-sm text-slate-400">{formatLocalDateTime(selected.detected_at)}</p>
                  </div>
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase text-rose-300">
                    {isAlertAttack(selected) ? getSeverity(getAlertScore(selected)) : "benign"}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg bg-slate-950/50 p-3">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="text-xl font-bold text-sky-400">{getAlertScore(selected).toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/50 p-3">
                    <p className="text-xs text-slate-500">Type</p>
                    <p className="text-sm font-bold text-slate-100">{selected.attack_type || "Unknown"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/50 p-3">
                    <p className="text-xs text-slate-500">Blocked</p>
                    <p className={`text-sm font-bold ${selectedBlocked || selected.blocked ? "text-amber-400" : "text-slate-400"}`}>
                      {selectedBlocked || selected.blocked ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950/50 p-3">
                    <p className="text-xs text-slate-500">Decision</p>
                    <p className={`text-sm font-bold ${isAlertAttack(selected) ? "text-rose-400" : "text-emerald-400"}`}>
                      {isAlertAttack(selected) ? "Alert" : "Benign"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                  <h3 className="font-bold text-slate-100">Evidence</h3>
                  <div className="mt-4 space-y-2">
                    {explainAlert(selected).map((reason) => (
                      <div key={reason} className="rounded-lg bg-slate-950/50 p-3 text-sm text-slate-300">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                  <h3 className="font-bold text-slate-100">Feature Values</h3>
                  <div className="mt-4 space-y-2">
                    {featureRows(selected).map(([label, value]) => (
                      <div key={String(label)} className="flex items-center justify-between rounded-lg bg-slate-950/50 p-3 text-sm">
                        <span className="text-slate-400">{label}</span>
                        <span className="font-mono text-slate-100">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="font-bold text-slate-100">Incident Timeline</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {[
                    ["1", "Flow captured", "Packets grouped into a flow window."],
                    ["2", "Features extracted", "Rates, SYN count, bytes, and ports calculated."],
                    ["3", "Model scored", `Score ${getAlertScore(selected).toFixed(3)} generated.`],
                    ["4", isAlertAttack(selected) ? "Alert created" : "Marked benign", selectedBlocked ? "IP is currently blocked." : "No active block found."],
                  ].map(([step, title, description]) => (
                    <div key={step} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                      <span className="rounded-full bg-sky-600 px-2 py-1 text-xs font-bold text-white">{step}</span>
                      <p className="mt-3 font-semibold text-slate-100">{title}</p>
                      <p className="mt-2 text-xs text-slate-500">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-10 text-center text-slate-500">
              No incident selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
