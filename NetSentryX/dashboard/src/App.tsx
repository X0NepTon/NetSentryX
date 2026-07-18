import React from "react";
import {
  fetchAlerts,
  fetchBlocked,
  fetchBlockedHistory,
  fetchConfig,
  fetchWhitelist,
  fetchStatus,
  updateConfig,
  manualBlock,
  manualUnblock,
  addWhitelist,
  removeWhitelist,
  detectFlow,
  formatLocalDateTime,
  formatLocalTime,
  getSeverity,
  isAlertAttack,
  type AlertDoc,
  type BlockDoc,
  type ConfigDoc,
  type DetectPreview,
  type SystemStatus,
} from "./api";
import SummaryCard from "./components/SummaryCard";
import AlertsTable from "./components/AlertsTable";
import AlertsHistory from "./components/AlertsHistory";
import BlockedHistory from "./components/BlockedHistory";
import NetworkMonitor from "./components/NetworkMonitor";
import BlockedList from "./components/BlockedList";
import ConfigPanel from "./components/ConfigPanel";
import WhitelistPanel from "./components/WhitelistPanel";
import ManualControls from "./components/ManualControls";
import AnalyticsView from "./components/AnalyticsView";
import ThreatIndicator, { ThreatIndicatorCompact } from "./components/ThreatIndicator";
import LiveActivityPulse, { LiveStatusDot } from "./components/LiveActivityPulse";
import DemoLabPage from "./pages/DemoLabPage";
import PlaybooksPage from "./pages/PlaybooksPage";
import ReportsPage from "./pages/ReportsPage";
import ModelCenterPage from "./pages/ModelCenterPage";
import IncidentDetailsPage from "./pages/IncidentDetailsPage";
import { usePolling } from "./hooks/usePolling";

function useNow(intervalMs: number) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

type ToastItem = {
  id: string;
  title: string;
  message: string;
  tone: "info" | "success" | "warning" | "danger";
};

function getAlertKey(alert: AlertDoc) {
  return alert._id || alert.id || `${alert.src_ip}-${alert.detected_at}-${alert.score}`;
}

function ToastStack({
  items,
  onClose,
}: {
  items: ToastItem[];
  onClose: (id: string) => void;
}) {
  if (!items.length) return null;

  const toneClass = {
    info: "border-sky-500/50 bg-sky-500/15 text-sky-100",
    success: "border-emerald-500/50 bg-emerald-500/15 text-emerald-100",
    warning: "border-amber-500/50 bg-amber-500/15 text-amber-100",
    danger: "border-rose-500/50 bg-rose-500/15 text-rose-100",
  };

  return (
    <div className="fixed right-4 top-24 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-xl border p-4 shadow-2xl backdrop-blur-md ${toneClass[item.tone]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{item.title}</p>
              <p className="mt-1 text-xs opacity-90">{item.message}</p>
            </div>

            <button
              onClick={() => onClose(item.id)}
              className="rounded-md px-2 py-1 text-xs opacity-70 hover:bg-white/10 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [alertsLimit, setAlertsLimit] = React.useState(20);
  const [sortOrder, setSortOrder] = React.useState<'recent' | 'oldest'>('recent');
  const [showHistory, setShowHistory] = React.useState(false);
  const [showBlockedHistory, setShowBlockedHistory] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState<'dashboard' | 'network' | 'analytics' | 'demo' | 'playbooks' | 'reports' | 'model' | 'incident'>('dashboard');
  const [toggleLoading, setToggleLoading] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const seenAttackIdsRef = React.useRef<Set<string> | null>(null);

  const alertsPoll = usePolling(() => fetchAlerts(alertsLimit), 5000, [alertsLimit]);
  const blockedPoll = usePolling(() => fetchBlocked(50), 5000, []);
  const blockedHistoryPoll = usePolling(() => fetchBlockedHistory(5000), 30000, []);
  const configPoll = usePolling(() => fetchConfig(), 15000, []);
  const whitelistPoll = usePolling(() => fetchWhitelist(100), 30000, []);
  const statusPoll = usePolling(() => fetchStatus(), 3000, []);
  const now = useNow(1000);

  let alerts = (alertsPoll.data ?? []) as AlertDoc[];

  if (sortOrder === 'oldest') {
    alerts = [...alerts].reverse();
  }

  const blocked = (blockedPoll.data ?? []) as BlockDoc[];
  const blockedHistory = (blockedHistoryPoll.data ?? []) as BlockDoc[];
  const whitelist = whitelistPoll.data ?? [];
  const config = (configPoll.data ?? null) as ConfigDoc | null;
  const status = (statusPoll.data ?? null) as SystemStatus | null;

  async function handleConfigSave(payload: Partial<ConfigDoc>) {
    await updateConfig(payload);
    const fresh = await fetchConfig();
    configPoll.setData(fresh);
  }

  async function handleBlockingToggle() {
    if (!config) return;
    try {
      setToggleLoading(true);
      await updateConfig({ blocking_enabled: !config.blocking_enabled });
      const fresh = await fetchConfig();
      configPoll.setData(fresh);
    } finally {
      setToggleLoading(false);
    }
  }

  async function handleManualBlock(ip: string, duration?: number, note?: string) {
    await manualBlock(ip, duration, note);
    const [freshBlocked, freshAlerts] = await Promise.all([
      fetchBlocked(50),
      fetchAlerts(20),
    ]);
    blockedPoll.setData(freshBlocked);
    alertsPoll.setData(freshAlerts);
  }

  async function handleManualUnblock(ip: string) {
    await manualUnblock(ip);
    const freshBlocked = await fetchBlocked(50);
    blockedPoll.setData(freshBlocked);
  }

  async function handleWhitelistAdd(ip: string, note?: string) {
    await addWhitelist(ip, note);
    const fresh = await fetchWhitelist(100);
    whitelistPoll.setData(fresh);
  }

  async function handleWhitelistRemove(ip: string) {
    await removeWhitelist(ip);
    const fresh = await fetchWhitelist(100);
    whitelistPoll.setData(fresh);
  }

  async function handleDetectPreview(payload: Record<string, unknown>): Promise<DetectPreview> {
    const result = await detectFlow(payload);

    const [freshAlerts, freshBlocked] = await Promise.all([
      fetchAlerts(alertsLimit),
      fetchBlocked(50),
    ]);

    alertsPoll.setData(freshAlerts);
    blockedPoll.setData(freshBlocked);

    const tone = result.alert ? "danger" : "success";
    setToasts((current) => [
      {
        id: `manual-${Date.now()}`,
        title: result.alert ? "Demo attack detected" : "Detection preview completed",
        message: `${String(payload.src_ip || "unknown")} • score ${result.score.toFixed(3)} • threshold ${result.threshold.toFixed(2)}`,
        tone,
      },
      ...current,
    ].slice(0, 4));

    return result;
  }


  async function refreshSecurityData() {
    const [freshAlerts, freshBlocked, freshBlockedHistory] = await Promise.all([
      fetchAlerts(alertsLimit),
      fetchBlocked(50),
      fetchBlockedHistory(5000),
    ]);

    alertsPoll.setData(freshAlerts);
    blockedPoll.setData(freshBlocked);
    blockedHistoryPoll.setData(freshBlockedHistory);
  }

  React.useEffect(() => {
    const attackAlerts = alerts.filter(isAlertAttack);
    const currentIds = new Set(attackAlerts.map(getAlertKey));

    if (seenAttackIdsRef.current === null) {
      seenAttackIdsRef.current = currentIds;
      return;
    }

    const newAttacks = attackAlerts.filter((alert) => !seenAttackIdsRef.current?.has(getAlertKey(alert)));

    if (newAttacks.length) {
      setToasts((current) => [
        ...newAttacks.slice(0, 3).map((alert) => {
          const severity = getSeverity(alert.score);

          return {
            id: `attack-${getAlertKey(alert)}-${Date.now()}`,
            title: `${severity.toUpperCase()} attack detected`,
            message: `${alert.src_ip} • ${alert.attack_type || "Attack"} • score ${alert.score.toFixed(3)}`,
            tone: severity === "critical" || severity === "high" ? "danger" : "warning",
          } as ToastItem;
        }),
        ...current,
      ].slice(0, 4));
    }

    seenAttackIdsRef.current = currentIds;
  }, [alerts]);

  React.useEffect(() => {
    if (!toasts.length) return;

    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [toasts]);

  const latestAttack = alerts.find(isAlertAttack);
  const attackRate = alerts.length
    ? alerts.filter(isAlertAttack).length / alerts.length
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 pb-12 text-slate-100 gradient-mesh">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/50 gradient-header backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src="/logo1.png" alt="NetSentryX" className="h-10 w-10 drop-shadow-lg" />
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 -z-10 h-10 w-10 rounded-full bg-sky-500/30 blur-lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                NetSentryX
              </h1>
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                {formatLocalDateTime(now)}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`
                px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${currentPage === 'dashboard'
                  ? 'bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-glow-sm'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </span>
            </button>
            <button
              onClick={() => setCurrentPage('analytics')}
              className={`
                px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${currentPage === 'analytics'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-glow-md'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </span>
            </button>
            <button
              onClick={() => setCurrentPage('network')}
              className={`
                px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                ${currentPage === 'network'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-glow-emerald'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Network
              </span>
            </button>

            {[
              ["demo", "Demo Lab", "M12 6v12m6-6H6"],
              ["playbooks", "Playbooks", "M4 6h16M4 12h16M4 18h16"],
              ["reports", "Reports", "M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"],
              ["model", "Model Center", "M11 4a2 2 0 114 0v1a1 1 0 001 1h1a2 2 0 110 4h-1a1 1 0 00-1 1v1a2 2 0 11-4 0v-1a1 1 0 00-1-1H9a2 2 0 110-4h1a1 1 0 001-1V4z"],
              ["incident", "Incident", "M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"],
            ].map(([page, label, path]) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page as any)}
                className={`
                  px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                  ${currentPage === page
                    ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
                  </svg>
                  {label}
                </span>
              </button>
            ))}
          </nav>

          {/* Status indicators */}
          <div className="flex items-center gap-3">
            {/* Live capture status */}
            <div className={`
              flex items-center gap-2 px-3 py-2 rounded-lg glass
              ${status?.live_capture_active ? 'border border-emerald-500/30' : 'border border-slate-700/50'}
            `}>
              <LiveStatusDot isActive={status?.live_capture_active ?? false} />
              <span className={`text-sm font-medium ${status?.live_capture_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                {status?.live_capture_active ? 'Live' : 'Off'}
              </span>
              {status?.flows_last_minute ? (
                <span className="text-xs text-slate-500">
                  {status.flows_last_minute}/min
                </span>
              ) : null}
            </div>

            {/* Threat indicator compact */}
            <ThreatIndicatorCompact alerts={alerts} />

            {/* Blocking toggle */}
            <button
              onClick={handleBlockingToggle}
              disabled={toggleLoading}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${(config?.blocking_enabled ?? true)
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-glow-emerald'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }
                ${toggleLoading ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              {toggleLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {(config?.blocking_enabled ?? true) ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Blocking ON
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />
                      </svg>
                      Blocking OFF
                    </>
                  )}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {currentPage === 'network' ? (
          <NetworkMonitor />
        ) : currentPage === 'analytics' ? (
          <AnalyticsView alerts={alerts} blockedHistory={blockedHistory} currentBlocked={blocked} />
        ) : currentPage === 'demo' ? (
          <DemoLabPage alerts={alerts} onRefresh={refreshSecurityData} />
        ) : currentPage === 'playbooks' ? (
          <PlaybooksPage alerts={alerts} />
        ) : currentPage === 'reports' ? (
          <ReportsPage alerts={alerts} blocked={blocked} blockedHistory={blockedHistory} />
        ) : currentPage === 'model' ? (
          <ModelCenterPage alerts={alerts} blocked={blocked} config={config} status={status} />
        ) : currentPage === 'incident' ? (
          <IncidentDetailsPage alerts={alerts} blocked={blocked} />
        ) : (
          <>
            {/* Threat Indicator - Full width */}
            <section className="animate-fade-in-up">
              <ThreatIndicator alerts={alerts} />
            </section>

            {/* Summary Cards */}
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Recent Alerts"
                value={alerts.length}
                hint="Last 20 alerts"
                variant="alerts"
              />
              <SummaryCard
                title="Attack Rate"
                value={`${(attackRate * 100).toFixed(1)}%`}
                hint="Attack vs benign in current window"
                variant={attackRate > 0.5 ? 'alerts' : attackRate > 0.2 ? 'warning' : 'success'}
                trend={attackRate > 0.3 ? 'up' : attackRate > 0 ? 'neutral' : 'down'}
              />
              <SummaryCard
                title="Blocked IPs"
                value={blocked.length}
                hint="Currently enforced"
                variant="blocked"
              />
              <SummaryCard
                title="Last Attack"
                value={latestAttack ? formatLocalTime(latestAttack.detected_at) : "—"}
                hint={latestAttack ? latestAttack.src_ip : "No attacks yet"}
                variant={latestAttack ? 'warning' : 'success'}
              />
            </section>

            {/* Main content grid */}
            <section className="grid gap-6 lg:grid-cols-3">
              {/* Alerts section - takes 2 columns */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Recent Alerts
                  </h2>
                  <div className="flex items-center gap-3">
                    {alertsPoll.loading && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Refreshing...
                      </span>
                    )}

                    {/* Sort Controls */}
                    <div className="flex gap-1 p-1 rounded-lg bg-slate-900/50 border border-slate-800/50">
                      <button
                        onClick={() => setSortOrder('recent')}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all ${sortOrder === 'recent'
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                          }`}
                      >
                        Recent
                      </button>
                      <button
                        onClick={() => setSortOrder('oldest')}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all ${sortOrder === 'oldest'
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                          }`}
                      >
                        Oldest
                      </button>
                    </div>

                    {/* Limit Controls */}
                    <div className="flex gap-1 p-1 rounded-lg bg-slate-900/50 border border-slate-800/50">
                      {[20, 50, 100].map((limit) => (
                        <button
                          key={limit}
                          onClick={() => setAlertsLimit(limit)}
                          className={`px-3 py-1.5 text-xs rounded-md transition-all ${alertsLimit === limit
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                            }`}
                        >
                          {limit}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowHistory(true)}
                        className="px-3 py-1.5 text-xs rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all"
                      >
                        All →
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                  Showing {alerts.length} alerts • Sorted by {sortOrder === 'recent' ? 'newest' : 'oldest'}
                </p>
                <AlertsTable alerts={alerts} />
              </div>

              {/* Blocked IPs sidebar */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Blocked IPs
                  </h2>
                  <div className="flex items-center gap-2">
                    {blockedPoll.loading && (
                      <span className="text-xs text-slate-500">Refreshing...</span>
                    )}
                    <button
                      onClick={() => setShowBlockedHistory(true)}
                      className="px-3 py-1.5 text-xs rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all"
                    >
                      History →
                    </button>
                  </div>
                </div>
                <BlockedList entries={blocked} onUnblock={handleManualUnblock} />
              </div>
            </section>

            {/* Configuration section */}
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Detection Policy
                  {configPoll.loading && <span className="text-xs text-slate-500 font-normal ml-2">Refreshing...</span>}
                </h2>
                <ConfigPanel config={config} onSave={handleConfigSave} />
                <ManualControls onPreview={handleDetectPreview} onBlock={handleManualBlock} />
              </div>
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Whitelist
                  {whitelistPoll.loading && <span className="text-xs text-slate-500 font-normal ml-2">Refreshing...</span>}
                </h2>
                <WhitelistPanel
                  entries={whitelist}
                  onAdd={handleWhitelistAdd}
                  onRemove={handleWhitelistRemove}
                />
              </div>
            </section>
          </>
        )}
      </main>

      <ToastStack
        items={toasts}
        onClose={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />

      {/* Modals */}
      {showHistory && <AlertsHistory onClose={() => setShowHistory(false)} />}
      {showBlockedHistory && <BlockedHistory onClose={() => setShowBlockedHistory(false)} />}
    </div>
  );
}
