export const EGYPT_TIME_ZONE = "Africa/Cairo";

export function parseApiDate(value?: string | Date | null): Date {
  if (!value) return new Date();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;

  const raw = String(value).trim();
  if (!raw) return new Date();

  if (raw.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  const asUtc = new Date(`${raw}Z`);
  if (!Number.isNaN(asUtc.getTime())) return asUtc;

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

export function formatEgyptDateTimeShort(value?: string | Date | null): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parseApiDate(value));
}

export function formatEgyptDateShort(value?: string | Date | null): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EGYPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parseApiDate(value));
}

export function formatEgyptTimeShort(value?: string | Date | null): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EGYPT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parseApiDate(value));
}

export function formatEgyptDateTime(value?: string | Date | null): string {
  return new Intl.DateTimeFormat("en-GB", {
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

export function formatEgyptTime(value?: string | Date | null): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EGYPT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parseApiDate(value));
}

// Compatibility aliases used by older dashboard files
export const formatLocalDateTime = formatEgyptDateTimeShort;
export const formatLocalTime = formatEgyptTimeShort;
export const toDate = parseApiDate;

export function getAlertDateValue(alert: any): string {
  return (
    alert?.detected_at ||
    alert?.timestamp ||
    alert?.created_at ||
    alert?.ts_start ||
    alert?.time ||
    new Date().toISOString()
  );
}
