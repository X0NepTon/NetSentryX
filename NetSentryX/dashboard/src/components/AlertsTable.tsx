import React, { useState } from "react";
import { getIPInfo } from "../utils/ipInfo";
import {
  formatLocalDateTime,
  getSeverity,
  isAlertAttack,
  parseApiDate,
  type AlertDoc,
  type SeverityLevel,
} from "../api";

function getTimeSince(ts: string): string {
  const d = parseApiDate(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const threatColors: Record<
  SeverityLevel,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    bar: string;
    label: string;
  }
> = {
  critical: {
    bg: "bg-red-500/20",
    border: "border-red-500/50",
    text: "text-red-400",
    dot: "threat-dot-critical",
    bar: "bg-red-500",
    label: "Critical",
  },
  high: {
    bg: "bg-orange-500/20",
    border: "border-orange-500/50",
    text: "text-orange-400",
    dot: "threat-dot-high",
    bar: "bg-orange-500",
    label: "High",
  },
  medium: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/50",
    text: "text-amber-400",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    label: "Medium",
  },
  low: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/50",
    text: "text-emerald-400",
    dot: "threat-dot-low",
    bar: "bg-emerald-500",
    label: "Low",
  },
};

function useIPInfo(ip: string) {
  const [info, setInfo] = React.useState<{
    hostname?: string;
    country?: string;
    loading: boolean;
  }>({ loading: false });

  const fetchInfo = async () => {
    if (!ip || info.hostname !== undefined || info.loading) return;

    setInfo({ loading: true });

    try {
      const data = await getIPInfo(ip);
      setInfo({
        hostname: data.hostname || "Unknown",
        country: data.country,
        loading: false,
      });
    } catch {
      setInfo({ hostname: "Unknown", country: undefined, loading: false });
    }
  };

  return { info, fetchInfo };
}

function ExplainAlert({ alert }: { alert: AlertDoc }) {
  const reasons: string[] = [];

  const features = alert.features || {};
  const pktsPerSec = alert.pkts_per_sec ?? features.pkts_per_sec ?? 0;
  const bytesPerSec = alert.bytes_per_sec ?? features.bytes_per_sec ?? 0;
  const synCount = alert.syn_count ?? features.syn_count ?? 0;
  const uniqueDstPorts = alert.unique_dst_ports ?? features.unique_dst_ports ?? 0;
  const totalPackets = alert.total_packets ?? features.total_packets ?? 0;

  if (alert.score >= (alert.threshold ?? 0)) reasons.push("Score exceeded threshold");
  if (pktsPerSec >= 100) reasons.push("High packets per second");
  if (bytesPerSec >= 30000) reasons.push("High bytes per second");
  if (synCount >= 10) reasons.push("High SYN count");
  if (uniqueDstPorts <= 1 && totalPackets >= 100) reasons.push("Focused traffic to limited ports");

  if (!reasons.length) {
    reasons.push(isAlertAttack(alert) ? "Model classified this flow as suspicious" : "No attack indicators detected");
  }

  return (
    <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

function AlertRow({ alert, index }: { alert: AlertDoc; index: number }) {
  const { info, fetchInfo } = useIPInfo(alert.src_ip);
  const [expanded, setExpanded] = useState(false);
  const attack = isAlertAttack(alert);
  const threatLevel = attack ? getSeverity(alert.score) : "low";
  const colors = threatColors[threatLevel];
  const isRecent = Date.now() - parseApiDate(alert.detected_at).getTime() < 60 * 1000;

  return (
    <>
      <tr
        onClick={() => {
          setExpanded(!expanded);
          fetchInfo();
        }}
        className={`
          table-row-animated cursor-pointer
          ${attack ? "bg-slate-900/40" : ""}
          ${isRecent && attack ? "animate-slide-in-left" : ""}
          ${index < 5 ? `stagger-${Math.min(index + 1, 5)}` : ""}
        `}
      >
        <td className="w-1">
          <div className={`h-full min-h-[64px] w-1 ${attack ? colors.bar : "bg-slate-700"}`} />
        </td>

        <td className="px-4 py-3.5">
          <div className="flex flex-col">
            <span className="font-medium text-slate-200">
              {formatLocalDateTime(alert.detected_at)}
            </span>
            <span className="text-xs text-slate-500">{getTimeSince(alert.detected_at)}</span>
          </div>
        </td>

        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${attack ? colors.dot : "bg-slate-600"}`} />
            <div>
              <div className="font-mono text-sky-300">{alert.src_ip}</div>
              {info.loading && <div className="text-xs text-slate-500">Loading location...</div>}
              {info.hostname && !info.loading && (
                <div className="text-xs text-slate-500">
                  {info.hostname}
                  {info.country ? ` • ${info.country}` : ""}
                </div>
              )}
            </div>
          </div>
        </td>

        <td className="px-4 py-3.5 text-right">
          <div className="flex flex-col items-end">
            <span className={`font-bold ${attack ? colors.text : "text-slate-400"}`}>
              {alert.score.toFixed(3)}
            </span>
            <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full ${attack ? colors.bar : "bg-slate-600"} transition-all duration-500`}
                style={{ width: `${Math.min(alert.score * 100, 100)}%` }}
              />
            </div>
          </div>
        </td>

        <td className="px-4 py-3.5 text-right text-slate-400">
          {alert.threshold?.toFixed(2) ?? "—"}
        </td>

        <td className="px-4 py-3.5 text-center">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`
                inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold
                ${attack ? `${colors.bg} ${colors.border} ${colors.text}` : "border-slate-700 bg-slate-800/50 text-slate-400"}
              `}
            >
              {attack && <span className={`h-1.5 w-1.5 rounded-full ${colors.bar} ${threatLevel === "critical" ? "animate-pulse" : ""}`} />}
              {attack ? alert.attack_type || "Attack" : "Benign"}
            </span>

            {attack ? (
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${colors.text}`}>
                {colors.label}
              </span>
            ) : null}
          </div>
        </td>

        <td className="px-4 py-3.5 text-slate-500">
          <div className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="animate-fade-in bg-slate-900/50">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid gap-4 text-sm md:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-slate-500">Source IP</div>
                <div className="font-mono text-sky-300">{alert.src_ip}</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-slate-500">Threat Score</div>
                <div className={`font-bold ${attack ? colors.text : "text-slate-300"}`}>
                  {alert.score.toFixed(4)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-slate-500">Severity</div>
                <div className={`font-semibold capitalize ${attack ? colors.text : "text-slate-300"}`}>
                  {attack ? colors.label : "None"}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-slate-500">Detection Time</div>
                <div className="text-slate-300">{formatLocalDateTime(alert.detected_at)}</div>
              </div>

              {info.hostname && (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Organization</div>
                  <div className="text-slate-300">{info.hostname}</div>
                </div>
              )}

              {info.country && (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Country</div>
                  <div className="text-slate-300">{info.country}</div>
                </div>
              )}

              <div className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase tracking-wider text-slate-500">Explain Alert</div>
                <ExplainAlert alert={alert} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AlertsTable({ alerts }: { alerts: AlertDoc[] }) {
  if (!alerts.length) {
    return (
      <div className="animate-fade-in rounded-xl border border-slate-800/50 p-8 text-center glass">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
          <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-medium text-slate-400">No alerts detected</p>
        <p className="mt-1 text-sm text-slate-500">Your network is currently secure</p>
      </div>
    );
  }

  const attackCount = alerts.filter(isAlertAttack).length;
  const criticalCount = alerts.filter((a) => isAlertAttack(a) && getSeverity(a.score) === "critical").length;

  return (
    <div className="space-y-3">
      {attackCount > 0 && (
        <div className="animate-fade-in flex items-center gap-4 rounded-lg border border-slate-800/50 bg-slate-900/50 px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            <span className="text-slate-400">
              <span className="font-semibold text-rose-400">{attackCount}</span> attacks detected
            </span>
          </div>

          {criticalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="threat-dot-critical h-2 w-2 rounded-full bg-red-600" />
              <span className="text-slate-400">
                <span className="font-semibold text-red-400">{criticalCount}</span> critical
              </span>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800/50 glass">
        <table className="min-w-full divide-y divide-slate-800/50 text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              <th className="w-1"></th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Time
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Source IP / Location
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                Score
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                Threshold
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status
              </th>
              <th className="w-8 px-4 py-3.5"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/30">
            {alerts.map((alert, index) => (
              <AlertRow key={alert._id || `${alert.src_ip}-${alert.detected_at}-${index}`} alert={alert} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
