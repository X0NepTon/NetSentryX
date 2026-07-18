import type { ReactNode } from "react";

interface SummaryCardProps {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  variant?: 'default' | 'alerts' | 'blocked' | 'success' | 'warning';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  animated?: boolean;
}

const variantStyles = {
  default: {
    gradient: 'gradient-card-sky',
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-400',
    valueColor: 'text-slate-100',
    glowClass: 'hover:shadow-glow-sm',
  },
  alerts: {
    gradient: 'gradient-card-rose',
    iconBg: 'bg-rose-500/20',
    iconColor: 'text-rose-400',
    valueColor: 'text-rose-300',
    glowClass: 'hover:shadow-glow-rose',
  },
  blocked: {
    gradient: 'gradient-card-amber',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    valueColor: 'text-amber-300',
    glowClass: 'hover:shadow-glow-amber',
  },
  success: {
    gradient: 'gradient-card-emerald',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    valueColor: 'text-emerald-300',
    glowClass: 'hover:shadow-glow-emerald',
  },
  warning: {
    gradient: 'gradient-card-purple',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    valueColor: 'text-purple-300',
    glowClass: 'hover:shadow-glow-md',
  },
};

// Default icons for each variant
const defaultIcons: Record<string, ReactNode> = {
  alerts: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  blocked: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  success: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  default: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  warning: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function SummaryCard({
  title,
  value,
  icon,
  hint,
  variant = 'default',
  trend,
  trendValue,
  animated = true,
}: SummaryCardProps) {
  const styles = variantStyles[variant];
  const displayIcon = icon ?? defaultIcons[variant];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border border-slate-800/50 p-5
        ${styles.gradient} backdrop-blur-sm
        transition-all duration-300 ease-out
        hover:border-slate-700/50 ${styles.glowClass}
        hover:-translate-y-0.5
        ${animated ? 'animate-fade-in-up' : ''}
      `}
    >
      {/* Animated shimmer overlay */}
      <div className="absolute inset-0 animate-shimmer pointer-events-none opacity-50" />

      {/* Gradient orb in background */}
      <div
        className={`
          absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl
          ${variant === 'alerts' ? 'bg-rose-500' :
            variant === 'blocked' ? 'bg-amber-500' :
              variant === 'success' ? 'bg-emerald-500' :
                variant === 'warning' ? 'bg-purple-500' : 'bg-sky-500'}
        `}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {title}
            </p>
            <div className={`mt-2 text-3xl font-bold ${styles.valueColor} stat-number`}>
              {value}
            </div>

            {/* Trend indicator */}
            {trend && trendValue && (
              <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-rose-400' :
                  trend === 'down' ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                {trend === 'up' && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {trend === 'down' && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <span>{trendValue}</span>
              </div>
            )}
          </div>

          {displayIcon && (
            <div className={`
              flex-shrink-0 p-3 rounded-xl ${styles.iconBg} ${styles.iconColor}
              transition-transform duration-300 hover:scale-110
            `}>
              {displayIcon}
            </div>
          )}
        </div>

        {hint && (
          <p className="mt-3 text-xs text-slate-500 truncate">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
