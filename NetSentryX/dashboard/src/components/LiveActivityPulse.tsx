import React from 'react';

interface LiveActivityPulseProps {
    isActive: boolean;
    flowsPerMinute?: number;
    className?: string;
}

export default function LiveActivityPulse({
    isActive,
    flowsPerMinute = 0,
    className = ''
}: LiveActivityPulseProps) {
    const intensity = Math.min(flowsPerMinute / 100, 1); // Normalize to 0-1
    const ringCount = Math.max(1, Math.min(3, Math.ceil(intensity * 3)));

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Animated pulse rings */}
            <div className="relative w-8 h-8">
                {/* Center dot */}
                <div className={`
          absolute inset-0 m-auto w-3 h-3 rounded-full
          ${isActive ? 'bg-emerald-500' : 'bg-slate-600'}
          transition-colors duration-300
        `} />

                {/* Pulse rings - only show when active */}
                {isActive && (
                    <>
                        {[...Array(ringCount)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute inset-0 m-auto rounded-full border-2 border-emerald-500/50"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    animation: `pulse-ring ${1.5 + i * 0.3}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                                    animationDelay: `${i * 0.3}s`,
                                }}
                            />
                        ))}
                    </>
                )}

                {/* Glow effect when active */}
                {isActive && (
                    <div className={`
            absolute inset-0 m-auto w-6 h-6 rounded-full
            bg-emerald-500/30 blur-md animate-glow
          `} />
                )}
            </div>

            {/* Status text */}
            <div className="flex flex-col">
                <span className={`
          text-sm font-semibold
          ${isActive ? 'text-emerald-400' : 'text-slate-500'}
        `}>
                    {isActive ? 'Live Capture' : 'Capture Off'}
                </span>
                {isActive && flowsPerMinute > 0 && (
                    <span className="text-xs text-slate-500">
                        {flowsPerMinute} flows/min
                    </span>
                )}
            </div>
        </div>
    );
}

// Compact status indicator for header
export function LiveStatusDot({ isActive }: { isActive: boolean }) {
    return (
        <div className="relative">
            <div className={`
        w-2.5 h-2.5 rounded-full
        ${isActive ? 'bg-emerald-500' : 'bg-slate-600'}
        transition-colors duration-300
      `} />
            {isActive && (
                <>
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500/50 blur-sm" />
                </>
            )}
        </div>
    );
}

// Activity sparkline visualization
export function ActivitySparkline({
    data = [],
    className = ''
}: {
    data: number[];
    className?: string
}) {
    const max = Math.max(...data, 1);
    const normalized = data.map(v => (v / max) * 100);

    if (data.length === 0) {
        return (
            <div className={`flex items-end gap-0.5 h-6 ${className}`}>
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="w-1 bg-slate-800 rounded-sm" style={{ height: '20%' }} />
                ))}
            </div>
        );
    }

    return (
        <div className={`flex items-end gap-0.5 h-6 ${className}`}>
            {normalized.slice(-12).map((height, i) => (
                <div
                    key={i}
                    className={`
            w-1 rounded-sm transition-all duration-300
            ${height > 70 ? 'bg-emerald-500' : height > 40 ? 'bg-sky-500' : 'bg-slate-600'}
          `}
                    style={{ height: `${Math.max(height, 10)}%` }}
                />
            ))}
        </div>
    );
}
