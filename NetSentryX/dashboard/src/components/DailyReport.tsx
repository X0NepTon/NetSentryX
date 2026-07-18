import React, { useState, useEffect } from 'react';
import { formatLocalDateKey, isAlertAttack, parseApiDate, type AlertDoc } from '../api';

interface DailyStats {
  date: string;
  totalAlerts: number;
  attacks: number;
  benign: number;
  uniqueIPs: number;
  topAttackType: string;
  avgScore: number;
}

export default function DailyReport({ alerts }: { alerts: AlertDoc[] }) {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    const days = selectedPeriod === '7d' ? 7 : 30;
    const now = new Date();
    const stats: DailyStats[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = formatLocalDateKey(date);

      const dayAlerts = alerts.filter(a => {
        const alertDate = formatLocalDateKey(a.detected_at);
        return alertDate === dateStr;
      });

      if (dayAlerts.length === 0) continue;

      const attacks = dayAlerts.filter(isAlertAttack);
      const uniqueIPs = new Set(dayAlerts.map(a => a.src_ip)).size;

      // Count attack types
      const attackTypeCounts: Record<string, number> = {};
      attacks.forEach(a => {
        const type = a.attack_type || 'Unknown';
        attackTypeCounts[type] = (attackTypeCounts[type] || 0) + 1;
      });

      const topAttackType = Object.entries(attackTypeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

      const avgScore = dayAlerts.reduce((sum, a) => sum + a.score, 0) / dayAlerts.length;

      stats.push({
        date: parseApiDate(date).toLocaleDateString('en-US', { timeZone: 'Africa/Cairo', month: 'short', day: 'numeric' }),
        totalAlerts: dayAlerts.length,
        attacks: attacks.length,
        benign: dayAlerts.length - attacks.length,
        uniqueIPs,
        topAttackType,
        avgScore,
      });
    }

    setDailyStats(stats.reverse());
  }, [alerts, selectedPeriod]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100">Daily Report</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedPeriod('7d')}
            className={`px-3 py-1 text-xs rounded ${
              selectedPeriod === '7d' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setSelectedPeriod('30d')}
            className={`px-3 py-1 text-xs rounded ${
              selectedPeriod === '30d' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {dailyStats.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No data available for selected period
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr className="text-slate-400 text-xs uppercase">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Attacks</th>
                <th className="px-3 py-2 text-right">Benign</th>
                <th className="px-3 py-2 text-right">Unique IPs</th>
                <th className="px-3 py-2 text-left">Top Attack</th>
                <th className="px-3 py-2 text-right">Avg Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dailyStats.map((stat, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-300">{stat.date}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{stat.totalAlerts}</td>
                  <td className="px-3 py-2 text-right text-rose-400 font-semibold">{stat.attacks}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{stat.benign}</td>
                  <td className="px-3 py-2 text-right text-amber-400">{stat.uniqueIPs}</td>
                  <td className="px-3 py-2 text-left">
                    <span className="inline-flex px-2 py-0.5 text-xs rounded bg-rose-500/20 text-rose-300">
                      {stat.topAttackType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">{stat.avgScore.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
