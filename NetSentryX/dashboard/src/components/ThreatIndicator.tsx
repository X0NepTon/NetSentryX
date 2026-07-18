import React from "react";
import {
  getSeverity,
  isAlertAttack,
  parseApiDate,
  type AlertDoc,
  type SeverityLevel,
} from "../api";

interface ThreatIndicatorProps {
  alerts: AlertDoc[];
  className?: string;
}

function getThreatLevel(alerts: AlertDoc[]): {
  level: SeverityLevel;
  score: number;
  description: string;
  attackCount: number;
  criticalCount: number;
} {
  if (!alerts.length) {
    return {
      level: "low",
      score: 0,
      description: "No threats detected",
      attackCount: 0,
      criticalCount: 0,
    };
  }

  const recentAlerts = alerts.filter((alert) => {
    const alertTime = parseApiDate(alert.detected_at).getTime();
    const now = Date.now();
    return now - alertTime < 5 * 60 * 1000;
  });

  const recentAttacks = recentAlerts.filter(isAlertAttack);
  const attackCount = recentAttacks.length;
  const criticalCount = recentAttacks.filter(
    (alert) => getSeverity(alert.score) === "critical"
  ).length;

  const maxScore = recentAttacks.length
    ? Math.max(...recentAttacks.map((alert) => alert.score))
    : 0;

  if (criticalCount >= 3 || maxScore >= 0.95) {
    return {
      level: "critical",
      score: 95,
      description: "Critical threat activity",
      attackCount,
      criticalCount,
    };
  }

  if (criticalCount >= 1 || attackCount >= 5 || maxScore >= 0.75) {
    return {
      level: "high",
      score: 75,
      description: "High threat activity",
      attackCount,
      criticalCount,
    };
  }

  if (attackCount >= 2 || maxScore >= 0.5) {
    return {
      level: "medium",
      score: 50,
      description: "Moderate threat activity",
      attackCount,
      criticalCount,
    };
  }

  if (attackCount >= 1) {
    return {
      level: "medium",
      score: 35,
      description: "Low threat activity",
      attackCount,
      criticalCount,
    };
  }

  return {
    level: "low",
    score: 10,
    description: "Network secure",
    attackCount,
    criticalCount,
  };
}

const levelConfig = {
  critical: {
    color: "from-red-600 to-red-500",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/50",
    textColor: "text-red-400",
    glowColor: "shadow-glow-rose",
    pulseRing: "bg-red-500",
    label: "CRITICAL",
  },
  high: {
    color: "from-orange-600 to-orange-500",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/50",
    textColor: "text-orange-400",
    glowColor: "shadow-glow-amber",
    pulseRing: "bg-orange-500",
    label: "HIGH",
  },
  medium: {
    color: "from-amber-600 to-amber-500",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/50",
    textColor: "text-amber-400",
    glowColor: "shadow-glow-amber",
    pulseRing: "bg-amber-500",
    label: "MEDIUM",
  },
  low: {
    color: "from-emerald-600 to-emerald-500",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/50",
    textColor: "text-emerald-400",
    glowColor: "shadow-glow-emerald",
    pulseRing: "bg-emerald-500",
    label: "SECURE",
  },
};

export default function ThreatIndicator({ alerts, className = "" }: ThreatIndicatorProps) {
  const { level, score, description, attackCount, criticalCount } = getThreatLevel(alerts);
  const config = levelConfig[level];
  const isHighThreat = level === "critical" || level === "high";

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          relative overflow-hidden rounded-xl border ${config.borderColor} ${config.bgColor}
          backdrop-blur-sm p-4 transition-all duration-300
          ${isHighThreat ? config.glowColor : ""}
        `}
      >
        {isHighThreat && (
          <div className="absolute inset-0 opacity-30">
            <div className={`absolute inset-0 ${config.bgColor} animate-pulse`} />
          </div>
        )}

        <div className="relative z-10">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className={`h-3 w-3 rounded-full ${config.pulseRing}`} />
                {isHighThreat && (
                  <div className={`absolute inset-0 h-3 w-3 animate-ping rounded-full ${config.pulseRing}`} />
                )}
              </div>

              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Threat Level
              </span>
            </div>

            <span
              className={`
                rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wider
                ${config.bgColor} ${config.textColor} ${config.borderColor}
                ${isHighThreat ? "animate-pulse" : ""}
              `}
            >
              {config.label}
            </span>
          </div>

          <div className="relative mb-3 h-3 overflow-hidden rounded-full bg-slate-800/80">
            <div className="absolute inset-0 flex">
              <div className="flex-1 bg-gradient-to-r from-emerald-600/20 to-amber-600/20" />
              <div className="flex-1 bg-gradient-to-r from-amber-600/20 to-orange-600/20" />
              <div className="flex-1 bg-gradient-to-r from-orange-600/20 to-red-600/20" />
            </div>

            <div
              className={`
                absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${config.color}
                transition-all duration-1000 ease-out
              `}
              style={{ width: `${score}%` }}
            >
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-slate-700/50" />
              <div className="flex-1 border-r border-slate-700/50" />
              <div className="flex-1" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-medium ${config.textColor}`}>{description}</p>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Last 5 min</span>
              <span>
                Attacks: <span className="font-semibold text-rose-300">{attackCount}</span>
              </span>
              <span>
                Critical: <span className="font-semibold text-red-300">{criticalCount}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThreatIndicatorCompact({ alerts }: { alerts: AlertDoc[] }) {
  const { level, attackCount } = getThreatLevel(alerts);
  const config = levelConfig[level];
  const isHighThreat = level === "critical" || level === "high";

  return (
    <div
      className={`
        flex items-center gap-2 rounded-lg px-3 py-1.5
        ${config.bgColor} border ${config.borderColor}
        transition-all duration-300
        ${isHighThreat ? "animate-pulse" : ""}
      `}
    >
      <div className="relative">
        <div className={`h-2 w-2 rounded-full ${config.pulseRing}`} />
        {isHighThreat && (
          <div className={`absolute inset-0 h-2 w-2 animate-ping rounded-full ${config.pulseRing}`} />
        )}
      </div>

      <span className={`text-xs font-semibold ${config.textColor}`}>
        {config.label}
      </span>

      {attackCount > 0 ? (
        <span className="rounded-full bg-slate-950/50 px-1.5 py-0.5 text-[10px] text-slate-300">
          {attackCount}
        </span>
      ) : null}
    </div>
  );
}
