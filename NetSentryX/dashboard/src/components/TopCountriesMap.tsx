import React, { useMemo } from 'react';
import type { BlockDoc } from '../api';

interface CountryData {
  country: string;
  count: number;
  percentage: number;
}

interface CountryLookupResult {
  country: string;
}

function isValidIPv4(ip?: string) {
  if (!ip) return false;
  if (ip === 'string' || ip === 'unknown' || ip === 'undefined' || ip === 'null') return false;

  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  return ipv4.test(ip);
}

function isPrivateIPv4(ip: string) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

function getCountryFromIP(ip?: string): CountryLookupResult {
  if (!isValidIPv4(ip)) {
    return { country: 'Unknown' };
  }

  if (isPrivateIPv4(ip)) {
    return { country: 'Local Network' };
  }

  /*
    Browser calls to public IP geolocation APIs can fail because of CORS.
    Keep this component stable by avoiding client-side external fetches.
    If accurate geo lookup is needed later, add a backend endpoint like:
    GET /ip/geo?ip=8.8.8.8
  */
  return { country: 'External Network' };
}

function CountryRow({ country, count, percentage }: CountryData) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800">
      <div className="flex-1">
        <span className="text-slate-200">{country}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-32 bg-slate-800 rounded-full h-2">
          <div
            className="bg-rose-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
          />
        </div>

        <span className="text-slate-300 w-12 text-right">{count}</span>
      </div>
    </div>
  );
}

export default function TopCountriesMap({ blockedHistory }: { blockedHistory: BlockDoc[] }) {
  const safeBlockedHistory = Array.isArray(blockedHistory) ? blockedHistory : [];

  const uniqueIPs = useMemo(() => {
    return Array.from(
      new Set(
        safeBlockedHistory
          .map((block) => block.ip || block.src_ip || '')
          .map((ip) => String(ip).trim())
          .filter(Boolean)
      )
    );
  }, [safeBlockedHistory]);

  const countryData = useMemo<CountryData[]>(() => {
    if (uniqueIPs.length === 0) return [];

    const counts: Record<string, number> = {};

    uniqueIPs.forEach((ip) => {
      const { country } = getCountryFromIP(ip);
      counts[country] = (counts[country] || 0) + 1;
    });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return Object.entries(counts)
      .map(([country, count]) => ({
        country,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [uniqueIPs]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">
        Top Attacking Countries
        <span className="text-xs text-slate-500 ml-2 font-normal">
          (Total Blocked: {safeBlockedHistory.length} | Unique IPs: {uniqueIPs.length})
        </span>
      </h3>

      {countryData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500">
          No blocked IPs available for country analysis
        </div>
      ) : (
        <div className="space-y-1">
          {countryData.map((data) => (
            <CountryRow key={data.country} {...data} />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600 mt-4">
        Note: Public IP geolocation is disabled in the browser to avoid CORS failures. External IPs are grouped safely.
      </p>
    </div>
  );
}
