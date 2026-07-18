const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(ADMIN_TOKEN ? { "X-Admin-Token": ADMIN_TOKEN } : {}),
    ...init.headers,
  };

  const separator = path.includes("?") ? "&" : "?";
  const noCachePath = `${path}${separator}_=${Date.now()}`;

  const res = await fetch(`${API_BASE}${noCachePath}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  return res.json();
}

function asArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.alerts)) return data.alerts;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.blocked_ips)) return data.blocked_ips;
  return [];
}

function getNumber(...values: any[]): number {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return 0;
}

function getString(...values: any[]): string {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

function getBoolean(...values: any[]): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }

    if (typeof value === "number") return value > 0;
  }

  return false;
}

export type SeverityLevel = "critical" | "high" | "medium" | "low";

export interface AlertDoc {
  _id: string;
  id?: string;

  detected_at: string;
  timestamp?: string;
  created_at?: string;

  src_ip: string;
  dst_ip?: string;

  score: number;
  confidence: number;
  threshold?: number;

  attack: boolean;
  alert: boolean;
  is_attack: boolean;

  attack_type?: string;
  model_prediction?: number;
  blocked?: boolean;

  severity: SeverityLevel;

  features?: Record<string, number>;

  total_packets?: number;
  total_bytes?: number;
  duration?: number;
  pkts_per_sec?: number;
  bytes_per_sec?: number;
  syn_count?: number;
  unique_dst_ports?: number;
}

export interface BlockDoc {
  _id: string;
  id?: string;

  ip: string;
  src_ip?: string;

  blocked_at: string;
  unblock_at?: string;
  expires_at?: string;

  duration_sec?: number;
  reason?: string;
  attack_type?: string;

  actor?: string;
  note?: string;
  active?: boolean;

  score?: number;
  confidence?: number;
}

export interface ConfigDoc {
  threshold: number;
  block_duration_sec: number;
  blocking_enabled?: boolean;
}

export interface DetectPreview {
  alert: boolean;
  attack?: boolean;
  is_attack?: boolean;
  score: number;
  confidence?: number;
  threshold: number;
  blocked?: boolean;
  attack_type?: string;
  note?: string;
  src_ip?: string;
}

export interface SystemStatus {
  status: string;
  timestamp: string;
  live_capture_active: boolean;
  flows_last_10s: number;
  flows_last_minute: number;
  model_loaded: boolean;
  db_connected: boolean;
}

export const EGYPT_TIME_ZONE = "Africa/Cairo";

export function parseApiDate(value?: string | Date | null) {
  if (!value) return new Date();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  const raw = String(value).trim();
  if (!raw) return new Date();

  if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  const utcDate = new Date(`${raw}Z`);
  if (!Number.isNaN(utcDate.getTime())) return utcDate;

  const localDate = new Date(raw);
  return Number.isNaN(localDate.getTime()) ? new Date() : localDate;
}

export function formatLocalDateTime(value?: string | Date | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parseApiDate(value));
}

export function formatLocalDateTimeShort(value?: string | Date | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parseApiDate(value));
}

export function formatLocalTime(value?: string | Date | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EGYPT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parseApiDate(value));
}

export function formatLocalTimeShort(value?: string | Date | null) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EGYPT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parseApiDate(value));
}

export function formatLocalDateKey(value?: string | Date | null) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parseApiDate(value));

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";

  return `${year}-${month}-${day}`;
}

export function getSeverity(score: number): SeverityLevel {
  if (score >= 0.85) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

export function isAlertAttack(alert: Pick<AlertDoc, "attack" | "alert" | "is_attack"> | any) {
  return Boolean(alert.attack || alert.alert || alert.is_attack);
}

export function getAlertScore(alert: Partial<AlertDoc> | any) {
  return getNumber(alert.score, alert.confidence, alert.attack_probability, alert.probability, alert.risk_score);
}

export function normalizeAlert(raw: any): AlertDoc {
  const score = getNumber(
    raw.score,
    raw.confidence,
    raw.attack_probability,
    raw.probability,
    raw.risk_score,
    raw.model_prediction
  );

  const isAttack = getBoolean(raw.attack, raw.alert, raw.is_attack, raw.isAttack, raw.malicious);

  const srcIP = getString(raw.src_ip, raw.source_ip, raw.ip, raw.client_ip, raw.features?.src_ip);

  const detectedAt =
    getString(raw.detected_at, raw.timestamp, raw.created_at, raw.ts_start, raw.time) ||
    new Date().toISOString();

  const attackType =
    getString(raw.attack_type, raw.type, raw.label, raw.prediction, raw.class_name) ||
    (isAttack ? "Attack" : "Benign");

  const totalPackets = getNumber(
    raw.total_packets,
    raw.packets,
    raw.total_pkts,
    raw.features?.total_packets,
    raw.features?.total_pkts,
    raw.features?.packets
  );

  const totalBytes = getNumber(
    raw.total_bytes,
    raw.bytes,
    raw.total_size,
    raw.features?.total_bytes,
    raw.features?.bytes
  );

  const duration = getNumber(raw.duration, raw.flow_duration, raw.features?.duration);
  const pktsPerSec = getNumber(raw.pkts_per_sec, raw.packets_per_second, raw.features?.pkts_per_sec);
  const bytesPerSec = getNumber(raw.bytes_per_sec, raw.bytes_per_second, raw.features?.bytes_per_sec);
  const synCount = getNumber(raw.syn_count, raw.syn, raw.features?.syn_count);
  const uniqueDstPorts = getNumber(raw.unique_dst_ports, raw.dst_ports, raw.features?.unique_dst_ports);

  return {
    ...raw,
    _id: getString(raw._id, raw.id, `${srcIP}-${detectedAt}-${score}`),
    id: getString(raw.id, raw._id),

    detected_at: detectedAt,
    timestamp: raw.timestamp,
    created_at: raw.created_at,

    src_ip: srcIP || "unknown",
    dst_ip: raw.dst_ip,

    score,
    confidence: score,
    threshold: getNumber(raw.threshold),

    attack: isAttack,
    alert: isAttack,
    is_attack: isAttack,

    attack_type: attackType,
    model_prediction: getNumber(raw.model_prediction),
    blocked: getBoolean(raw.blocked),

    severity: getSeverity(score),

    total_packets: totalPackets,
    total_bytes: totalBytes,
    duration,
    pkts_per_sec: pktsPerSec,
    bytes_per_sec: bytesPerSec,
    syn_count: synCount,
    unique_dst_ports: uniqueDstPorts,

    features: {
      ...(raw.features || {}),
      total_packets: totalPackets,
      total_bytes: totalBytes,
      duration,
      pkts_per_sec: pktsPerSec,
      bytes_per_sec: bytesPerSec,
      syn_count: synCount,
      unique_dst_ports: uniqueDstPorts,
    },
  };
}

export function normalizeBlock(raw: any): BlockDoc {
  const ip = getString(raw.ip, raw.src_ip, raw.source_ip);
  const blockedAt =
    getString(raw.blocked_at, raw.timestamp, raw.created_at) || new Date().toISOString();

  const unblockAt = getString(raw.unblock_at, raw.expires_at, raw.expire_at, raw.until);

  return {
    ...raw,
    _id: getString(raw._id, raw.id, `${ip}-${blockedAt}`),
    id: getString(raw.id, raw._id),

    ip,
    src_ip: getString(raw.src_ip, raw.ip, raw.source_ip),

    blocked_at: blockedAt,
    unblock_at: unblockAt,
    expires_at: unblockAt,

    duration_sec: getNumber(raw.duration_sec, raw.duration),
    reason: getString(raw.reason, raw.attack_type, raw.type, raw.label),
    attack_type: getString(raw.attack_type, raw.reason, raw.type, raw.label),

    actor: raw.actor,
    note: raw.note,
    active: raw.active !== false,

    score: getNumber(raw.score, raw.confidence),
    confidence: getNumber(raw.confidence, raw.score),
  };
}

export function fetchAlerts(limit = 20) {
  return request<any>(`/alerts/recent?limit=${limit}`).then((data) =>
    asArray<any>(data).map(normalizeAlert)
  );
}

export function fetchBlocked(limit = 50) {
  return request<any>(`/blocked?limit=${limit}`).then((data) =>
    asArray<any>(data).map(normalizeBlock)
  );
}

export function fetchBlockedHistory(limit = 5000) {
  return request<any>(`/blocked/history?limit=${limit}`)
    .then((data) => asArray<any>(data).map(normalizeBlock))
    .catch(() => fetchBlocked(limit));
}

export function fetchConfig() {
  return request<ConfigDoc>(`/admin/config`);
}

export function updateConfig(payload: Partial<ConfigDoc>) {
  return request<{ ok: boolean; config: ConfigDoc }>(`/admin/config`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function manualBlock(ip: string, duration_sec?: number, note?: string) {
  return request<{ ok: boolean }>(`/admin/block`, {
    method: "POST",
    body: JSON.stringify({ ip, duration_sec, note }),
  });
}

export function manualUnblock(ip: string) {
  return request<{ ok: boolean }>(`/admin/block/${encodeURIComponent(ip)}`, {
    method: "DELETE",
  });
}

export function addWhitelist(ip: string, note?: string) {
  return request<{ ok: boolean }>(`/whitelist/add`, {
    method: "POST",
    body: JSON.stringify({ ip, note }),
  });
}

export function removeWhitelist(ip: string) {
  return request<{ ok: boolean }>(`/whitelist/${encodeURIComponent(ip)}`, {
    method: "DELETE",
  });
}

export function fetchWhitelist(limit = 100) {
  return request<any>(`/whitelist?limit=${limit}`).then((data) =>
    asArray<{ _id?: string; ip: string; note?: string; created_at?: string }>(data)
  );
}

export function detectFlow(payload: Record<string, unknown>) {
  return request<any>("/detect", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((data) => ({
    ...data,
    alert: Boolean(data.alert || data.attack || data.is_attack),
    attack: Boolean(data.attack || data.alert || data.is_attack),
    is_attack: Boolean(data.is_attack || data.alert || data.attack),
    score: getNumber(data.score, data.confidence),
    confidence: getNumber(data.confidence, data.score),
    threshold: getNumber(data.threshold),
    attack_type: getString(data.attack_type, data.type, data.label),
    src_ip: getString(data.src_ip, payload.src_ip),
  })) as Promise<DetectPreview>;
}

export function fetchStatus() {
  return request<SystemStatus>("/status");
}

export function buildDemoAttackPayload(srcIp = "10.0.0.90") {
  return {
    src_ip: srcIp,
    total_packets: 500,
    total_bytes: 100000,
    duration: 1,
    pkts_per_sec: 500,
    bytes_per_sec: 100000,
    syn_count: 80,
    unique_dst_ports: 1,
  };
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value === undefined || value === null ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
