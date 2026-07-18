import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { isAlertAttack, parseApiDate, type AlertDoc } from '../api';

interface AttackTypeData {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  'Brute Force': '#f43f5e',
  'DDoS': '#ef4444',
  'Port Scan': '#f97316',
  'Bot': '#f59e0b',
  'Suspicious Activity': '#eab308',
  'Other': '#64748b',
};

// Custom active shape for hover effect
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.3))' }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.5}
      />
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#f1f5f9" fontSize={16} fontWeight="bold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize={12}>
        {value} attacks ({(percent * 100).toFixed(1)}%)
      </text>
    </g>
  );
};

export default function AttackTypePieChart({ alerts }: { alerts: AlertDoc[] }) {
  const [data, setData] = useState<AttackTypeData[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | 'all'>('24h');
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    const now = Date.now();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    const rangeMs = ranges[timeRange];

    const filteredAlerts = alerts.filter(a => {
      if (!isAlertAttack(a)) return false;
      const alertTime = parseApiDate(a.detected_at).getTime();
      return now - alertTime <= rangeMs;
    });

    const counts: Record<string, number> = {};
    filteredAlerts.forEach(alert => {
      const type = alert.attack_type || 'Other';
      counts[type] = (counts[type] || 0) + 1;
    });

    const chartData: AttackTypeData[] = Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        color: COLORS[name as keyof typeof COLORS] || COLORS['Other'],
      }))
      .sort((a, b) => b.value - a.value);

    setData(chartData);
  }, [alerts, timeRange]);

  const totalAttacks = data.reduce((sum, d) => sum + d.value, 0);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  return (
    <div className="rounded-xl border border-slate-800/50 glass p-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            Attack Types
          </h3>
          <p className="text-xs text-slate-500 mt-1">Distribution by category</p>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 p-1 rounded-lg bg-slate-900/50 border border-slate-800/50">
          {(['1h', '24h', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === range
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                }`}
            >
              {range === '1h' ? '1 Hour' : range === '24h' ? '24 Hours' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-72 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-emerald-400 font-medium">No Attacks Detected</p>
            <p className="text-sm text-slate-500 mt-1">Network is secure in selected time range</p>
          </div>
        </div>
      ) : (
        <>
          {/* Center stats */}
          <div className="text-center mb-2">
            <div className="text-4xl font-bold text-rose-400 animate-count-up">{totalAttacks}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Total Attacks</div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                animationBegin={0}
                animationDuration={1000}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    style={{
                      filter: activeIndex === index ? 'brightness(1.2)' : 'brightness(1)',
                      transition: 'filter 0.2s ease'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                }}
                formatter={(value: number) => [`${value} attacks`, 'Count']}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend with bars */}
          <div className="mt-4 space-y-2">
            {data.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/30 transition-colors cursor-default"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300 truncate">{item.name}</span>
                    <span className="text-xs text-slate-500">
                      {item.value} ({((item.value / totalAttacks) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(item.value / totalAttacks) * 100}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
