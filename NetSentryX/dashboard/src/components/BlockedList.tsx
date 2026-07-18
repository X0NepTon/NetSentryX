import React from "react";
import type { BlockDoc } from "../api";
import { IPInfoDisplay } from "../utils/ipInfo";

function formatDate(ts?: string) {
  if (!ts) return "—";
  const utcString = ts.endsWith('Z') ? ts : ts + 'Z';
  const d = new Date(utcString);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
}

function getTimeRemaining(unblockAt?: string): string | null {
  if (!unblockAt) return null;
  const utcString = unblockAt.endsWith('Z') ? unblockAt : unblockAt + 'Z';
  const d = new Date(utcString);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expiring...';

  const diffSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getThreatSeverity(reason?: string): 'critical' | 'high' | 'medium' {
  if (!reason) return 'medium';
  const r = reason.toLowerCase();
  if (r.includes('ddos') || r.includes('critical')) return 'critical';
  if (r.includes('brute') || r.includes('scan')) return 'high';
  return 'medium';
}

const severityConfig = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400 border-red-500/50',
    icon: 'text-red-500',
    pulse: true,
  },
  high: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    icon: 'text-orange-500',
    pulse: false,
  },
  medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    icon: 'text-amber-500',
    pulse: false,
  },
};

function BlockedItem({
  entry,
  onUnblock,
  index
}: {
  entry: BlockDoc;
  onUnblock: (ip: string) => void;
  index: number;
}) {
  const [isUnblocking, setIsUnblocking] = React.useState(false);
  const severity = getThreatSeverity(entry.reason);
  const config = severityConfig[severity];
  const timeRemaining = getTimeRemaining(entry.unblock_at);

  const handleUnblock = async () => {
    setIsUnblocking(true);
    try {
      await onUnblock(entry.ip);
    } finally {
      setIsUnblocking(false);
    }
  };

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl border ${config.border} ${config.bg}
        backdrop-blur-sm p-4 transition-all duration-300
        hover:border-opacity-50 hover:shadow-lg hover:-translate-y-0.5
        animate-fade-in-up
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Background glow effect */}
      <div className={`
        absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-30
        ${severity === 'critical' ? 'bg-red-500' : severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}
      `} />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* IP and Status Badge */}
          <div className="flex items-center gap-3 mb-2">
            {/* Threat indicator */}
            <div className={`
              w-3 h-3 rounded-full ${severity === 'critical' ? 'bg-red-500 animate-pulse' :
                severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}
            `} />

            <p className="font-mono text-lg font-semibold text-rose-200 group-hover:text-rose-100 transition-colors">
              {entry.ip}
            </p>

            {/* Active block badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Blocked
            </span>
          </div>

          {/* IP Info */}
          <div className="text-sm mb-3">
            <IPInfoDisplay ip={entry.ip} />
          </div>

          {/* Time info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Blocked: {formatDate(entry.blocked_at)}</span>
            </div>

            {timeRemaining && (
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-amber-400 font-medium">Expires in: {timeRemaining}</span>
              </div>
            )}
          </div>

          {/* Reason badge */}
          {entry.reason && (
            <div className="mt-3">
              <span className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border
                ${config.badge}
              `}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {entry.reason}
              </span>
            </div>
          )}

          {/* Note */}
          {entry.note && (
            <p className="mt-2 text-xs text-slate-500 italic">
              "{entry.note}"
            </p>
          )}
        </div>

        {/* Unblock button */}
        <button
          type="button"
          onClick={handleUnblock}
          disabled={isUnblocking}
          className={`
            flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium
            border border-rose-500/30 text-rose-300
            bg-rose-500/10 hover:bg-rose-500/20
            transition-all duration-200
            hover:shadow-glow-rose hover:border-rose-500/50
            disabled:opacity-50 disabled:cursor-not-allowed
            group-hover:border-rose-500/50
          `}
        >
          {isUnblocking ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Unblocking...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Unblock
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export default function BlockedList({
  entries,
  onUnblock,
}: {
  entries: BlockDoc[];
  onUnblock: (ip: string) => void;
}) {
  if (!entries.length) {
    return (
      <div className="rounded-xl border border-slate-800/50 glass p-8 text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <p className="text-emerald-400 font-medium">All Clear</p>
        <p className="text-sm text-slate-500 mt-1">No IPs currently blocked</p>
      </div>
    );
  }

  const criticalCount = entries.filter(e => getThreatSeverity(e.reason) === 'critical').length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-800/50 text-xs animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-slate-400">
            <span className="font-semibold text-rose-400">{entries.length}</span> IP{entries.length !== 1 ? 's' : ''} blocked
          </span>
        </div>
        {criticalCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-red-400 font-medium">{criticalCount} critical</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {entries.map((entry, index) => (
          <BlockedItem
            key={entry._id}
            entry={entry}
            onUnblock={onUnblock}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
