import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatLocalTimeShort, isAlertAttack, parseApiDate, type AlertDoc } from '../api';

interface TrendData {
  time: string;
  attacks: number;
  benign: number;
  total: number;
}

export default function AttackTrendsChart({ alerts }: { alerts: AlertDoc[] }) {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');

  useEffect(() => {
    if (!alerts.length) return;

    const now = Date.now();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };
    const rangeMs = ranges[timeRange];
    const bucketSize = timeRange === '1h' ? 5 * 60 * 1000 : timeRange === '6h' ? 30 * 60 * 1000 : 60 * 60 * 1000;

    const buckets: Record<number, { attacks: number; benign: number }> = {};

    const startTime = Math.floor((now - rangeMs) / bucketSize) * bucketSize;
    for (let t = startTime; t <= now; t += bucketSize) {
      buckets[t] = { attacks: 0, benign: 0 };
    }

    alerts.forEach(alert => {
      const alertTime = parseApiDate(alert.detected_at).getTime();
      if (now - alertTime > rangeMs) return;

      const bucketTime = Math.floor(alertTime / bucketSize) * bucketSize;
      if (!buckets[bucketTime]) {
        buckets[bucketTime] = { attacks: 0, benign: 0 };
      }

      if (isAlertAttack(alert)) {
        buckets[bucketTime].attacks++;
      } else {
        buckets[bucketTime].benign++;
      }
    });

    const data: TrendData[] = Object.entries(buckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([time, counts]) => ({
        time: formatLocalTimeShort(new Date(parseInt(time))),
        attacks: counts.attacks,
        benign: counts.benign,
        total: counts.attacks + counts.benign,
      }));

    setTrendData(data);
  }, [alerts, timeRange]);

  const totalAttacks = trendData.reduce((sum, d) => sum + d.attacks, 0);
  const totalBenign = trendData.reduce((sum, d) => sum + d.benign, 0);

  return (
    <div className="rounded-xl border border-slate-800/50 glass p-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Attack Trends
          </h3>
          <p className="text-xs text-slate-500 mt-1">Network threat activity over time</p>
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 p-1 rounded-lg bg-slate-900/50 border border-slate-800/50">
          {(['1h', '6h', '24h'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === range
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                }`}
            >
              {range === '1h' ? '1 Hour' : range === '6h' ? '6 Hours' : '24 Hours'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/50">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total Flows</div>
          <div className="text-xl font-bold text-slate-100 mt-1">{totalAttacks + totalBenign}</div>
        </div>
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
          <div className="text-xs text-rose-400 uppercase tracking-wider">Attacks</div>
          <div className="text-xl font-bold text-rose-400 mt-1">{totalAttacks}</div>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="text-xs text-emerald-400 uppercase tracking-wider">Benign</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{totalBenign}</div>
        </div>
      </div>

      {trendData.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-500">No data available for selected time range</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorBenign" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#475569"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#1e293b' }}
            />
            <YAxis
              stroke="#475569"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#1e293b' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(8px)',
              }}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="attacks"
              stroke="#f43f5e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAttacks)"
              name="Attacks"
              animationDuration={1000}
            />
            <Area
              type="monotone"
              dataKey="benign"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBenign)"
              name="Benign"
              animationDuration={1200}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              fillOpacity={1}
              fill="url(#colorTotal)"
              name="Total"
              animationDuration={1400}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
