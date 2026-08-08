import { describe, expect, it } from "vitest";
import {
  DEFAULT_INTERVAL_HOURS,
  MAX_INTERVAL_HOURS,
  MIN_INTERVAL_HOURS,
  isAutoSyncDue,
  sanitizeIntervalHours,
  scheduleBase,
} from "@/lib/dapodik-scheduler";

describe("sanitizeIntervalHours", () => {
  it("mengembalikan nilai bulat dalam rentang yang diizinkan", () => {
    expect(sanitizeIntervalHours(6)).toBe(6);
    expect(sanitizeIntervalHours(24)).toBe(24);
    expect(sanitizeIntervalHours(24.7)).toBe(25);
  });

  it("menjepit nilai di bawah batas minimum", () => {
    expect(sanitizeIntervalHours(0)).toBe(MIN_INTERVAL_HOURS);
    expect(sanitizeIntervalHours(-5)).toBe(MIN_INTERVAL_HOURS);
  });

  it("menjepit nilai di atas batas maksimum", () => {
    expect(sanitizeIntervalHours(9999)).toBe(MAX_INTERVAL_HOURS);
  });

  it("fallback ke default untuk nilai non-angka", () => {
    expect(sanitizeIntervalHours(Number.NaN)).toBe(DEFAULT_INTERVAL_HOURS);
    expect(sanitizeIntervalHours(Number.POSITIVE_INFINITY)).toBe(DEFAULT_INTERVAL_HOURS);
  });
});

describe("isAutoSyncDue", () => {
  const now = new Date("2026-08-08T12:00:00Z");

  it("tidak jalan kalau auto-sync dinonaktifkan", () => {
    expect(
      isAutoSyncDue({ enabled: false, lastSyncAt: new Date("2026-08-01T00:00:00Z"), intervalHours: 24, now })
    ).toBe(false);
  });

  it("langsung jalan kalau belum pernah sync sama sekali", () => {
    expect(isAutoSyncDue({ enabled: true, lastSyncAt: null, intervalHours: 24, now })).toBe(true);
  });

  it("belum waktunya kalau interval belum lewat", () => {
    const lastSync = new Date("2026-08-08T02:00:00Z"); // 10 jam lalu
    expect(isAutoSyncDue({ enabled: true, lastSyncAt: lastSync, intervalHours: 24, now })).toBe(false);
  });

  it("sudah waktunya kalau interval sudah lewat", () => {
    const lastSync = new Date("2026-08-06T12:00:00Z"); // 48 jam lalu
    expect(isAutoSyncDue({ enabled: true, lastSyncAt: lastSync, intervalHours: 24, now })).toBe(true);
  });

  it("tepat di batas interval dianggap sudah waktunya", () => {
    const lastSync = new Date("2026-08-07T12:00:00Z"); // tepat 24 jam lalu
    expect(isAutoSyncDue({ enabled: true, lastSyncAt: lastSync, intervalHours: 24, now })).toBe(true);
  });

  it("interval jam di-sanitize sebelum dihitung", () => {
    const lastSync = new Date("2026-08-07T12:00:00Z"); // 24 jam lalu, tapi interval 0 → clamp ke 1 jam
    expect(isAutoSyncDue({ enabled: true, lastSyncAt: lastSync, intervalHours: 0, now })).toBe(true);
  });
});

describe("scheduleBase", () => {
  it("null bila belum pernah sync sama sekali", () => {
    expect(scheduleBase({ lastSyncAt: null, autoSyncLastRunAt: null })).toBeNull();
  });

  it("memakai lastSyncAt bila hanya itu yang ada", () => {
    const d = new Date("2026-08-08T10:00:00Z");
    expect(scheduleBase({ lastSyncAt: d, autoSyncLastRunAt: null })).toEqual(d);
  });

  it("memakai autoSyncLastRunAt bila hanya itu yang ada (percobaan gagal)", () => {
    const d = new Date("2026-08-08T10:00:00Z");
    expect(scheduleBase({ lastSyncAt: null, autoSyncLastRunAt: d })).toEqual(d);
  });

  it("memakai yang TERBARU dari keduanya — percobaan gagal tidak diabaikan", () => {
    const lastSync = new Date("2026-08-07T12:00:00Z");
    const failedAttempt = new Date("2026-08-08T10:00:00Z"); // lebih baru dari lastSync
    expect(scheduleBase({ lastSyncAt: lastSync, autoSyncLastRunAt: failedAttempt })).toEqual(failedAttempt);
  });
});
