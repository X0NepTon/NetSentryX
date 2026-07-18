import React from 'react';
import type { AlertDoc } from '../api';
import type { BlockDoc } from '../api';
import AttackTrendsChart from './AttackTrendsChart';
import AttackTypePieChart from './AttackTypePieChart';
import TopCountriesMap from './TopCountriesMap';
import DailyReport from './DailyReport';
import IPReputationScoring from './IPReputationScoring';

function isAttack(alert: AlertDoc) {
  return Boolean(alert.attack || alert.alert || alert.is_attack);
}

function getScore(alert: AlertDoc) {
  const score = Number(alert.score ?? alert.confidence ?? 0);
  return Number.isFinite(score) ? score : 0;
}

export default function AnalyticsView({
  alerts,
  blockedHistory,
  currentBlocked
}: {
  alerts: AlertDoc[];
  blockedHistory: BlockDoc[];
  currentBlocked: BlockDoc[];
}) {
  const totalAttacks = alerts.filter(isAttack).length;
  const criticalAttacks = alerts.filter(a => isAttack(a) && getScore(a) >= 0.9).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            Security Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1 ml-14">
            Comprehensive analysis of network threats and patterns
          </p>
        </div>

        {/* Quick stats badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-800/50">
            <span className="text-slate-500 text-sm">Alerts:</span>
            <span className="font-bold text-slate-100">{alerts.length}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
            <span className="text-rose-400 text-sm">Attacks:</span>
            <span className="font-bold text-rose-400">{totalAttacks}</span>
          </div>
          {criticalAttacks > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 animate-pulse">
              <span className="text-red-400 text-sm">Critical:</span>
              <span className="font-bold text-red-400">{criticalAttacks}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-amber-400 text-sm">Blocked:</span>
            <span className="font-bold text-amber-400">{currentBlocked.length}</span>
          </div>
        </div>
      </div>

      {/* Top Row - Trend Chart (Full Width) */}
      <div className="grid gap-6">
        <AttackTrendsChart alerts={alerts} />
      </div>

      {/* Middle Row - Pie Chart and Countries */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AttackTypePieChart alerts={alerts} />
        <TopCountriesMap blockedHistory={blockedHistory} />
      </div>

      {/* IP Reputation */}
      <div className="grid gap-6">
        <IPReputationScoring blockedHistory={blockedHistory} />
      </div>

      {/* Daily Report */}
      <div className="grid gap-6">
        <DailyReport alerts={alerts} />
      </div>
    </div>
  );
}
