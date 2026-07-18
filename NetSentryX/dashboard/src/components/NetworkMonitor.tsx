import React, { useState, useEffect } from "react";
import { fetchAlerts, formatLocalTimeShort, isAlertAttack, parseApiDate, type AlertDoc } from "../api";
import { getIPInfo } from "../utils/ipInfo";

interface NetworkStats {
  totalIPs: number;
  totalFlows: number;
  totalBytes: number;
  totalPackets: number;
  uploadBytes: number;
  downloadBytes: number;
  topIPs: {
    ip: string;
    hostname?: string;
    flows: number;
    bytes: number;
    packets: number;
    avgScore: number;
    attacks: number;
  }[];
  timelineData: {
    hour: string;
    bytes: number;
    packets: number;
    flows: number;
  }[];
}

// Hook to resolve an IP label without external browser requests
function useHostname(ip: string) {
  const [hostname, setHostname] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function resolveHostname() {
      if (!ip) {
        setHostname("Unknown");
        return;
      }

      setLoading(true);

      try {
        const info = await getIPInfo(ip);

        if (!cancelled) {
          setHostname(info.hostname || "Unknown");
        }
      } catch {
        if (!cancelled) {
          setHostname("Unknown");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    resolveHostname();

    return () => {
      cancelled = true;
    };
  }, [ip]);

  return { hostname, loading };
}

// IP Row component with hostname lookup
function IPRow({ 
  ip, 
  idx, 
  maxBytes 
}: { 
  ip: NetworkStats['topIPs'][0]; 
  idx: number; 
  maxBytes: number;
}) {
  const { hostname, loading } = useHostname(ip.ip);

  return (
    <tr className="hover:bg-slate-800/30">
      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
      <td className="px-4 py-3">
        <div className="font-mono text-sky-400">{ip.ip}</div>
        {loading && <div className="text-xs text-slate-600 mt-0.5">Loading...</div>}
        {hostname && !loading && (
          <div className="text-xs text-slate-500 mt-0.5">{hostname}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-slate-100">
        {formatBytes(ip.bytes)}
      </td>
      <td className="px-4 py-3 text-right text-slate-300">
        {formatNumber(ip.packets)}
      </td>
      <td className="px-4 py-3 text-right text-slate-300">
        {ip.flows}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-semibold ${
          ip.avgScore > 0.5 ? 'text-rose-400' : ip.avgScore > 0.2 ? 'text-amber-400' : 'text-emerald-400'
        }`}>
          {ip.avgScore.toFixed(3)}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {ip.attacks > 0 ? (
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-rose-500/20 text-rose-300">
            {ip.attacks}
          </span>
        ) : (
          <span className="text-slate-600">0</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-sky-500 to-purple-500 h-2 rounded-full"
            style={{ width: `${maxBytes > 0 ? (ip.bytes / maxBytes) * 100 : 0}%` }}
          ></div>
        </div>
      </td>
    </tr>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  
  // Show appropriate decimals based on size
  if (i === 0) return value + ' B'; // No decimals for bytes
  if (i === 1) return value.toFixed(0) + ' KB'; // No decimals for KB
  return value.toFixed(2) + ' ' + sizes[i]; // 2 decimals for MB, GB, TB
}

function formatNumber(num: number) {
  return num.toLocaleString();
}

export default function NetworkMonitor() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [viewMode, setViewMode] = useState<'top-ips' | 'timeline' | 'protocols'>('top-ips');

  async function fetchNetworkStats() {
    try {
      // Fetch alerts to calculate network stats
      const limit = timeRange === '1h' ? 100 : timeRange === '6h' ? 500 : timeRange === '24h' ? 1000 : 2000;
      const alerts = await fetchAlerts(limit);

      // Calculate stats
      const ipMap = new Map<string, {
        flows: number;
        bytes: number;
        packets: number;
        scores: number[];
        attacks: number;
      }>();

      const hourlyMap = new Map<string, {
        bytes: number;
        packets: number;
        flows: number;
      }>();

      let totalBytes = 0;
      let totalPackets = 0;

      alerts.forEach(alert => {
        // Use ACTUAL flow data from features (cast to any because AlertDoc may not include features)
        const _alert = alert as any;
        const actualBytes = _alert.features?.total_bytes || 0;
        const actualPackets = _alert.features?.total_packets || 0;
  
        totalBytes += actualBytes;
        totalPackets += actualPackets;

        // Group by IP
        if (!ipMap.has(alert.src_ip)) {
          ipMap.set(alert.src_ip, {
            flows: 0,
            bytes: 0,
            packets: 0,
            scores: [],
            attacks: 0
          });
        }
        const ipData = ipMap.get(alert.src_ip)!;
        ipData.flows++;
        ipData.bytes += actualBytes;
        ipData.packets += actualPackets;
        ipData.scores.push(alert.score);
        if (isAlertAttack(alert)) ipData.attacks++;

        // Group by hour
        const date = parseApiDate(alert.detected_at);
        const hourKey = formatLocalTimeShort(date);
        
        if (!hourlyMap.has(hourKey)) {
          hourlyMap.set(hourKey, { bytes: 0, packets: 0, flows: 0 });
        }
        const hourData = hourlyMap.get(hourKey)!;
        hourData.bytes += actualBytes;
        hourData.packets += actualPackets;
        hourData.flows++;
      });

      // Convert to arrays and sort
      const topIPs = Array.from(ipMap.entries())
        .map(([ip, data]) => ({
          ip,
          flows: data.flows,
          bytes: data.bytes,
          packets: data.packets,
          avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
          attacks: data.attacks
        }))
        .sort((a, b) => b.bytes - a.bytes);
        // Show ALL IPs, not just top 20

      const timelineData = Array.from(hourlyMap.entries())
        .map(([hour, data]) => ({
          hour,
          bytes: data.bytes,
          packets: data.packets,
          flows: data.flows
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      setStats({
        totalIPs: ipMap.size,
        totalFlows: alerts.length,
        totalBytes,
        totalPackets,
        uploadBytes: Math.floor(totalBytes * 0.4), // Estimate
        downloadBytes: Math.floor(totalBytes * 0.6), // Estimate
        topIPs,
        timelineData
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch network stats:', error);
      // Set empty stats on error to stop loading
      setStats({
        totalIPs: 0,
        totalFlows: 0,
        totalBytes: 0,
        totalPackets: 0,
        uploadBytes: 0,
        downloadBytes: 0,
        topIPs: [],
        timelineData: []
      });
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNetworkStats();
    const interval = setInterval(fetchNetworkStats, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading && !stats) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
        <p className="mt-4">Loading network statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No network data available</p>
      </div>
    );
  }

  const maxBytes = Math.max(...stats.topIPs.map(ip => ip.bytes), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Network Monitor</h2>
          <p className="text-sm text-slate-400 mt-1">Real-time network usage and traffic analysis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('1h')}
            className={`px-3 py-1.5 text-xs rounded ${
              timeRange === '1h' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            1 Hour
          </button>
          <button
            onClick={() => setTimeRange('6h')}
            className={`px-3 py-1.5 text-xs rounded ${
              timeRange === '6h' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            6 Hours
          </button>
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-3 py-1.5 text-xs rounded ${
              timeRange === '24h' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            24 Hours
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1.5 text-xs rounded ${
              timeRange === '7d' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            7 Days
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase">Total Data Analyzed</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{formatBytes(stats.totalBytes)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase">Upload</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{formatBytes(stats.uploadBytes)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase">Download</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{formatBytes(stats.downloadBytes)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase">Total Flows</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{formatNumber(stats.totalFlows)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase">Packets</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{formatNumber(stats.totalPackets)}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase">Unique IPs</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{stats.totalIPs}</div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setViewMode('top-ips')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            viewMode === 'top-ips'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Top IPs
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            viewMode === 'timeline'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setViewMode('protocols')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            viewMode === 'protocols'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Analysis
        </button>
      </div>

      {/* Content */}
      {viewMode === 'top-ips' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 bg-slate-900/80 border-b border-slate-800">
            <h3 className="font-semibold text-slate-100">All IPs by Data Usage ({stats.topIPs.length} total)</h3>
            <p className="text-xs text-slate-500 mt-1">Showing all sources with bandwidth consumption</p>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">IP Address / Hostname</th>
                  <th className="px-4 py-3 text-right">Data Usage</th>
                  <th className="px-4 py-3 text-right">Packets</th>
                  <th className="px-4 py-3 text-right">Flows</th>
                  <th className="px-4 py-3 text-right">Avg Score</th>
                  <th className="px-4 py-3 text-center">Attacks</th>
                  <th className="px-4 py-3 text-left">Usage Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats.topIPs.map((ip, idx) => (
                  <IPRow key={ip.ip} ip={ip} idx={idx} maxBytes={maxBytes} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
          <h3 className="font-semibold text-slate-100 mb-4">Traffic Over Time</h3>
          <div className="space-y-4">
            {stats.timelineData.map((data, idx) => {
              const maxTimelineBytes = Math.max(...stats.timelineData.map(d => d.bytes), 1);
              const percentage = (data.bytes / maxTimelineBytes) * 100;
              
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-24 text-xs text-slate-400 text-right">{data.hour}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-800 rounded-full h-6 relative overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-sky-500 h-6 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        >
                          <span className="text-xs font-semibold text-white">
                            {formatBytes(data.bytes)}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 w-16 text-right">
                        {data.flows} flows
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'protocols' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
            <h3 className="font-semibold text-slate-100 mb-4">Data Distribution</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Upload</span>
                  <span className="text-emerald-400 font-semibold">
                    {formatBytes(stats.uploadBytes)} ({((stats.uploadBytes/stats.totalBytes)*100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3">
                  <div
                    className="bg-emerald-500 h-3 rounded-full"
                    style={{ width: `${stats.totalBytes > 0 ? (stats.uploadBytes / stats.totalBytes) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Download</span>
                  <span className="text-purple-400 font-semibold">
                    {formatBytes(stats.downloadBytes)} ({((stats.downloadBytes/stats.totalBytes)*100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3">
                  <div
                    className="bg-purple-500 h-3 rounded-full"
                    style={{ width: `${stats.totalBytes > 0 ? (stats.downloadBytes / stats.totalBytes) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
            <h3 className="font-semibold text-slate-100 mb-4">Network Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                <span className="text-slate-400">Average Flow Size</span>
                <span className="text-slate-100 font-semibold">
                  {stats.totalFlows > 0 ? formatBytes(Math.floor(stats.totalBytes / stats.totalFlows)) : '0 B'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                <span className="text-slate-400">Packets per Flow</span>
                <span className="text-slate-100 font-semibold">
                  {stats.totalFlows > 0 ? Math.floor(stats.totalPackets / stats.totalFlows) : 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                <span className="text-slate-400">Flows per IP</span>
                <span className="text-slate-100 font-semibold">
                  {stats.totalIPs > 0 ? (stats.totalFlows / stats.totalIPs).toFixed(1) : '0.0'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                <span className="text-slate-400">Attack Rate</span>
                <span className="text-rose-400 font-semibold">
                  {stats.totalFlows > 0 ? ((stats.topIPs.reduce((sum, ip) => sum + ip.attacks, 0) / stats.totalFlows) * 100).toFixed(2) : '0.00'}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
