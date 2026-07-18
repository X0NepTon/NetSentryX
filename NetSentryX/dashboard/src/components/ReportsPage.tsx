import React from "react";
import {
  downloadCsv,
  formatLocalDateTime,
  getAlertScore,
  getSeverity,
  isAlertAttack,
  parseApiDate,
  type AlertDoc,
  type BlockDoc,
} from "../api";

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item || "Unknown"] = (acc[item || "Unknown"] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(data: Record<string, number>, limit = 5) {
  return Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export default function ReportsPage({
  alerts,
  blocked,
  blockedHistory,
}: {
  alerts: AlertDoc[];
  blocked: BlockDoc[];
  blockedHistory: BlockDoc[];
}) {
  const [range, setRange] = React.useState<"24h" | "7d" | "all">("24h");

  const filtered = React.useMemo(() => {
    if (range === "all") return alerts;

    const hours = range === "24h" ? 24 : 24 * 7;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    return alerts.filter((alert) => parseApiDate(alert.detected_at).getTime() >= cutoff);
  }, [alerts, range]);

  const attacks = filtered.filter(isAlertAttack);
  const benign = filtered.length - attacks.length;
  const critical = attacks.filter((alert) => getSeverity(getAlertScore(alert)) === "critical").length;
  const avgScore = filtered.length
    ? filtered.reduce((sum, alert) => sum + getAlertScore(alert), 0) / filtered.length
    : 0;

  const topTypes = topEntries(countBy(attacks.map((alert) => alert.attack_type || "Attack")));
  const topSources = topEntries(countBy(attacks.map((alert) => alert.src_ip || "unknown")));

  function exportAlerts() {
    downloadCsv(
      `netsentryx-report-${range}.csv`,
      filtered.map((alert) => ({
        time: formatLocalDateTime(alert.detected_at),
        src_ip: alert.src_ip,
        attack: isAlertAttack(alert),
        attack_type: alert.attack_type || "Unknown",
        severity: getSeverity(getAlertScore(alert)),
        score: getAlertScore(alert).toFixed(3),
        blocked: alert.blocked ? "yes" : "no",
        packets: alert.total_packets || alert.features?.total_packets || 0,
        bytes: alert.total_bytes || alert.features?.total_bytes || 0,
      }))
    );
  }

  function exportBlocked() {
    downloadCsv(
      "netsentryx-blocked-report.csv",
      [...blocked, ...blockedHistory].map((entry) => ({
        ip: entry.ip,
        reason: entry.reason || entry.attack_type || "",
        blocked_at: formatLocalDateTime(entry.blocked_at),
        unblock_at: entry.unblock_at || entry.expires_at || "",
        active: entry.active !== false ? "yes" : "no",
      }))
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Exportable summaries for alerts, blocked IPs, and attack patterns.
          </p>
        </div>

        <div className="flex gap-2">
          {(["24h", "7d", "all"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                range === item
                  ? "bg-sky-600 text-white"
                  : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {item === "24h" ? "24 Hours" : item === "7d" ? "7 Days" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Alerts", filtered.length, "text-slate-100"],
          ["Attacks", attacks.length, "text-rose-400"],
          ["Benign", benign, "text-emerald-400"],
          ["Critical", critical, "text-red-400"],
          ["Avg Score", avgScore.toFixed(3), "text-sky-400"],
        ].map(([label, value, cls]) => (
          <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-100">Top Attack Types</h2>
            <button onClick={exportAlerts} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500">
              Export Alerts CSV
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {topTypes.length ? (
              topTypes.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-lg bg-slate-950/50 p-3">
                  <span className="text-slate-300">{type}</span>
                  <span className="font-bold text-rose-400">{count}</span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No attacks in this range.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-100">Top Source IPs</h2>
            <button onClick={exportBlocked} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 hover:border-amber-500/50">
              Export Blocked CSV
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {topSources.length ? (
              topSources.map(([ip, count]) => (
                <div key={ip} className="flex items-center justify-between rounded-lg bg-slate-950/50 p-3">
                  <span className="font-mono text-sky-300">{ip}</span>
                  <span className="font-bold text-rose-400">{count}</span>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No source IPs in this range.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="font-bold text-slate-100">Report Notes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-slate-950/50 p-4 text-sm text-slate-400">
            Use this page to export evidence for project discussion.
          </div>
          <div className="rounded-lg bg-slate-950/50 p-4 text-sm text-slate-400">
            Attack counts use normalized fields: attack, alert, and is_attack.
          </div>
          <div className="rounded-lg bg-slate-950/50 p-4 text-sm text-slate-400">
            Times are displayed in your local system timezone.
          </div>
        </div>
      </div>
    </div>
  );
}
