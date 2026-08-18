export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/** Format a Rupiah amount, e.g. 50000 → "Rp 50.000". */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Compact Rupiah amount for tight spaces like chips, e.g. 24000000 → "Rp 24 jt".
 * Uses the "compact" notation (id-ID: "rb" / "jt" / "M").
 */
export function formatCompactCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Format a byte count, e.g. 1536000 → "1,5 MB". */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** i;
  const rounded = value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[i]}`;
}

export function formatDate(
  date: string | Date | null,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  }
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", opts).format(d);
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function relativeTime(date: string | Date | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "baru saja";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} hari lalu`;
  return formatDate(d);
}

export function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} menit baca`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/**
 * Parse a date-only input ("YYYY-MM-DD") as a local date at noon.
 * This avoids the timezone off-by-one bug where `new Date("2026-12-15")`
 * is interpreted as UTC midnight and, in negative-offset timezones,
 * displays as the previous day. Noon local time is safe across all
 * timezones (max offset is ~-12h, so noon stays on the same calendar day).
 *
 * For values that already include a time component (ISO with T), the
 * original value is returned unchanged so existing timestamps are preserved.
 */
export function parseDateInput(value: string): Date {
  if (!value) return new Date();
  // If it looks like a full ISO timestamp, parse directly.
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d, 12, 0, 0);
  }
  // Fallback: let Date parse it.
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
