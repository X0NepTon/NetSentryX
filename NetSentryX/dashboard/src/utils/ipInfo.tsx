// Shared IP info cache without external browser requests.
// This avoids CORS failures from public IP APIs and keeps the dashboard stable.

import React from "react";

export interface IPInfo {
  hostname?: string;
  country?: string;
  loading: boolean;
  type?: "local" | "external" | "unknown";
}

const cache = new Map<string, IPInfo>();
const pending = new Map<string, Promise<IPInfo>>();

export function isValidIPv4(ip: string) {
  if (!ip || ip === "string" || ip === "unknown") return false;

  return /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(ip);
}

export function isPrivateIP(ip: string) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith("127.") ||
    ip === "localhost"
  );
}

function buildIPInfo(ip: string): IPInfo {
  if (!isValidIPv4(ip)) {
    return {
      hostname: "Unknown",
      country: undefined,
      loading: false,
      type: "unknown",
    };
  }

  if (isPrivateIP(ip)) {
    return {
      hostname: "Local Network",
      country: "Private IP",
      loading: false,
      type: "local",
    };
  }

  return {
    hostname: "External Network",
    country: "Public IP",
    loading: false,
    type: "external",
  };
}

export async function getIPInfo(ip: string): Promise<IPInfo> {
  if (cache.has(ip)) {
    return cache.get(ip)!;
  }

  if (pending.has(ip)) {
    return pending.get(ip)!;
  }

  const promise = Promise.resolve(buildIPInfo(ip));
  pending.set(ip, promise);

  const result = await promise;
  pending.delete(ip);
  cache.set(ip, result);

  return result;
}

export function useIPInfoCache(ip: string): IPInfo {
  const [info, setInfo] = React.useState<IPInfo>(() => ({
    ...buildIPInfo(ip),
    loading: false,
  }));

  React.useEffect(() => {
    let cancelled = false;

    getIPInfo(ip).then((result) => {
      if (!cancelled) {
        setInfo(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ip]);

  return info;
}

export function IPInfoDisplay({ ip }: { ip: string }) {
  const info = useIPInfoCache(ip);

  if (info.loading) {
    return <span className="text-xs text-slate-500">Loading...</span>;
  }

  if (!info.hostname) {
    return null;
  }

  return (
    <span className="text-xs text-slate-400">
      {info.hostname}
      {info.country && ` • ${info.country}`}
    </span>
  );
}
