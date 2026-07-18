import React, { useEffect, useMemo, useState } from "react";
import {
  downloadCsv,
  fetchAlerts,
  formatLocalDateTime,
  formatLocalDateKey,
  EGYPT_TIME_ZONE,
  isAlertAttack,
  parseApiDate,
  type AlertDoc,
} from "../api";

interface AlertsHistoryProps {
  onClose: () => void;
}

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatHour(ts: string) {
  return ts;
}

function egyptHourKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
  }).formatToParts(parseApiDate(value));

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value || "";

  return `${month}/${day}/${year} ${hour}:00 ${dayPeriod}`;
}

function groupAlertsByHour(alerts: AlertDoc[]) {
  const groups: Record<string, AlertDoc[]> = {};

  alerts.forEach((alert) => {
const hourKey = egyptHourKey(alert.detected_at);

    if (!groups[hourKey]) {
      groups[hourKey] = [];
    }

    groups[hourKey].push(alert);
  });

  return groups;
}

function severityClass(score: number) {
  if (score >= 0.85) return "bg-red-500/15 text-red-300 border-red-500/40";
  if (score >= 0.6) return "bg-orange-500/15 text-orange-300 border-orange-500/40";
  if (score >= 0.35) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
}

function severityLabel(score: number) {
  if (score >= 0.85) return "Critical";
  if (score >= 0.6) return "High";
  if (score >= 0.35) return "Medium";
  return "Low";
}

export default function AlertsHistory({ onClose }: AlertsHistoryProps) {
  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"hourly" | "list">("hourly");
  const [typeFilter, setTypeFilter] = useState<"all" | "attacks" | "benign">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    setEndDate(toDatetimeLocalValue(now));
    setStartDate(toDatetimeLocalValue(yesterday));
  }, []);

  async function loadAlerts() {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchAlerts(5000);

      let filtered = data;

      if (startDate) {
        const start = new Date(startDate).getTime();
        filtered = filtered.filter((a) => parseApiDate(a.detected_at).getTime() >= start);
      }

      if (endDate) {
        const end = new Date(endDate).getTime();
        filtered = filtered.filter((a) => parseApiDate(a.detected_at).getTime() <= end);
      }

      if (typeFilter === "attacks") {
        filtered = filtered.filter(isAlertAttack);
      }

      if (typeFilter === "benign") {
        filtered = filtered.filter((a) => !isAlertAttack(a));
      }

      setAlerts(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      loadAlerts();
    }
  }, [startDate, endDate, typeFilter]);

  const groupedAlerts = useMemo(
    () => (viewMode === "hourly" ? groupAlertsByHour(alerts) : {}),
    [alerts, viewMode]
  );

  const stats = useMemo(() => {
    const attacks = alerts.filter(isAlertAttack);
    const critical = attacks.filter((a) => a.score >= 0.85);

    return {
      total: alerts.length,
      attacks: attacks.length,
      benign: alerts.length - attacks.length,
      critical: critical.length,
      avgScore: alerts.length
        ? alerts.reduce((sum, alert) => sum + alert.score, 0) / alerts.length
        : 0,
    };
  }, [alerts]);

  function handleExportCsv() {
    downloadCsv(
      `netsentryx-alerts-${formatLocalDateKey(new Date())}.csv`,
      alerts.map((alert) => ({
        time: formatLocalDateTime(alert.detected_at),
        src_ip: alert.src_ip,
        status: isAlertAttack(alert) ? "Attack" : "Benign",
        attack_type: alert.attack_type || (isAlertAttack(alert) ? "Attack" : "Benign"),
        severity: severityLabel(alert.score),
        score: alert.score.toFixed(4),
        threshold: alert.threshold ?? "",
        total_packets: alert.total_packets ?? alert.features?.total_packets ?? "",
        total_bytes: alert.total_bytes ?? alert.features?.total_bytes ?? "",
        syn_count: alert.syn_count ?? alert.features?.syn_count ?? "",
        unique_dst_ports: alert.unique_dst_ports ?? alert.features?.unique_dst_ports ?? "",
      }))
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-sm">
      <div className="min-h-screen p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">Alerts History</h1>
              <p className="mt-1 text-sm text-slate-400">
                Complete alert timeline with local time filtering and CSV export
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
            >
              Close
            </button>
          </div>

          <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-4 grid gap-4 md:grid-cols-5">
              <label className="text-xs uppercase tracking-wide text-slate-500">
                Start Date/Time
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </label>

              <label className="text-xs uppercase tracking-wide text-slate-500">
                End Date/Time
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </label>

              <label className="text-xs uppercase tracking-wide text-slate-500">
                Filter
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | "attacks" | "benign")}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="all">All traffic</option>
                  <option value="attacks">Attacks only</option>
                  <option value="benign">Benign only</option>
                </select>
              </label>

              <div className="flex items-end gap-2">
                <button
                  onClick={loadAlerts}
                  disabled={loading}
                  className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>

                <button
                  onClick={handleExportCsv}
                  disabled={!alerts.length}
                  className="rounded-md border border-emerald-500/50 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>

              <div className="flex items-end justify-end">
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode("hourly")}
                    className={`rounded-md px-3 py-2 text-sm ${
                      viewMode === "hourly"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    Hourly
                  </button>

                  <button
                    onClick={() => setViewMode("list")}
                    className={`rounded-md px-3 py-2 text-sm ${
                      viewMode === "list"
                        ? "bg-sky-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    List
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-5">
              <div className="rounded-lg bg-slate-950/50 p-3">
                <div className="text-xs uppercase text-slate-500">Total Alerts</div>
                <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
              </div>

              <div className="rounded-lg bg-slate-950/50 p-3">
                <div className="text-xs uppercase text-slate-500">Attacks</div>
                <div className="text-2xl font-bold text-rose-400">{stats.attacks}</div>
              </div>

              <div className="rounded-lg bg-slate-950/50 p-3">
                <div className="text-xs uppercase text-slate-500">Critical</div>
                <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
              </div>

              <div className="rounded-lg bg-slate-950/50 p-3">
                <div className="text-xs uppercase text-slate-500">Benign</div>
                <div className="text-2xl font-bold text-emerald-400">{stats.benign}</div>
              </div>

              <div className="rounded-lg bg-slate-950/50 p-3">
                <div className="text-xs uppercase text-slate-500">Avg Score</div>
                <div className="text-2xl font-bold text-sky-400">
                  {stats.avgScore.toFixed(3)}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading alerts...</div>
          ) : viewMode === "hourly" ? (
            <div className="space-y-4">
              {Object.entries(groupedAlerts).length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-12 text-center text-slate-400">
                  No alerts found for this range.
                </div>
              ) : (
                Object.entries(groupedAlerts)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([hour, hourAlerts]) => {
                    const attackCount = hourAlerts.filter(isAlertAttack).length;

                    return (
                      <div
                        key={hour}
                        className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
                          <div>
                            <h3 className="font-semibold text-slate-100">
                              {formatHour(hour)}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {hourAlerts.length} alerts • {attackCount} attacks
                            </p>
                          </div>

                          {attackCount > 0 ? (
                            <span className="rounded-full bg-rose-500/20 px-3 py-1 text-sm font-semibold text-rose-300">
                              {attackCount} attack{attackCount !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-semibold text-emerald-300">
                              Secure
                            </span>
                          )}
                        </div>

                        <div className="divide-y divide-slate-800">
                          {hourAlerts.map((alert) => (
                            <div
                              key={alert._id}
                              className="grid gap-3 px-4 py-3 text-sm md:grid-cols-6"
                            >
                              <div className="text-slate-400">
                                {formatLocalDateTime(alert.detected_at)}
                              </div>

                              <div className="font-mono text-sky-400">{alert.src_ip}</div>

                              <div>
                                <span
                                  className={`rounded-full border px-2 py-1 text-xs font-semibold ${severityClass(
                                    alert.score
                                  )}`}
                                >
                                  {severityLabel(alert.score)}
                                </span>
                              </div>

                              <div className="text-slate-300">
                                {isAlertAttack(alert)
                                  ? alert.attack_type || "Attack"
                                  : "Benign"}
                              </div>

                              <div className="text-right font-semibold text-slate-100">
                                {alert.score.toFixed(3)}
                              </div>

                              <div className="text-right text-slate-500">
                                threshold {alert.threshold?.toFixed(2) ?? "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
              {alerts.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  No alerts found for this range.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">
                        Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">
                        Source IP
                      </th>
                      <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">
                        Severity
                      </th>
                      <th className="px-4 py-3 text-left text-xs uppercase text-slate-500">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs uppercase text-slate-500">
                        Score
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800">
                    {alerts.map((alert) => (
                      <tr key={alert._id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-400">
                          {formatLocalDateTime(alert.detected_at)}
                        </td>
                        <td className="px-4 py-3 font-mono text-sky-400">
                          {alert.src_ip}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-semibold ${severityClass(
                              alert.score
                            )}`}
                          >
                            {severityLabel(alert.score)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {isAlertAttack(alert) ? alert.attack_type || "Attack" : "Benign"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-100">
                          {alert.score.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
