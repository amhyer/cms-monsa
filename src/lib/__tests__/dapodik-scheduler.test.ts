import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    dapodikConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/dapodik-sync", () => ({
  runSync: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  sanitizeIntervalHours,
  isAutoSyncDue,
  scheduleBase,
  MIN_INTERVAL_HOURS,
  MAX_INTERVAL_HOURS,
  DEFAULT_INTERVAL_HOURS,
} from "../dapodik-scheduler";

describe("dapodik-scheduler", () => {
  describe("sanitizeIntervalHours", () => {
    it("returns default for non-finite values", () => {
      expect(sanitizeIntervalHours(NaN)).toBe(DEFAULT_INTERVAL_HOURS);
      expect(sanitizeIntervalHours(Infinity)).toBe(DEFAULT_INTERVAL_HOURS);
    });

    it("clamps to MIN_INTERVAL_HOURS for values below minimum", () => {
      expect(sanitizeIntervalHours(0)).toBe(MIN_INTERVAL_HOURS);
      expect(sanitizeIntervalHours(-5)).toBe(MIN_INTERVAL_HOURS);
      expect(sanitizeIntervalHours(0.3)).toBe(MIN_INTERVAL_HOURS);
    });

    it("clamps to MAX_INTERVAL_HOURS for values above maximum", () => {
      expect(sanitizeIntervalHours(1000)).toBe(MAX_INTERVAL_HOURS);
      expect(sanitizeIntervalHours(99999)).toBe(MAX_INTERVAL_HOURS);
    });

    it("rounds fractional hours to nearest integer", () => {
      expect(sanitizeIntervalHours(2.3)).toBe(2);
      expect(sanitizeIntervalHours(2.7)).toBe(3);
      expect(sanitizeIntervalHours(24)).toBe(24);
    });
  });

  describe("isAutoSyncDue", () => {
    it("returns false when auto-sync is disabled", () => {
      expect(
        isAutoSyncDue({
          enabled: false,
          lastSyncAt: null,
          intervalHours: 24,
        })
      ).toBe(false);
    });

    it("returns true when never synced (lastSyncAt is null)", () => {
      expect(
        isAutoSyncDue({
          enabled: true,
          lastSyncAt: null,
          intervalHours: 24,
        })
      ).toBe(true);
    });

    it("returns true when interval has elapsed since last sync", () => {
      const now = new Date("2026-08-21T12:00:00Z");
      const lastSync = new Date("2026-08-20T11:00:00Z"); // 25 hours ago
      expect(
        isAutoSyncDue({
          enabled: true,
          lastSyncAt: lastSync,
          intervalHours: 24,
          now,
        })
      ).toBe(true);
    });

    it("returns false when interval has not yet elapsed", () => {
      const now = new Date("2026-08-21T12:00:00Z");
      const lastSync = new Date("2026-08-21T00:00:00Z"); // 12 hours ago
      expect(
        isAutoSyncDue({
          enabled: true,
          lastSyncAt: lastSync,
          intervalHours: 24,
          now,
        })
      ).toBe(false);
    });

    it("returns true at exactly the interval boundary", () => {
      const now = new Date("2026-08-21T12:00:00Z");
      const lastSync = new Date("2026-08-20T12:00:00Z"); // exactly 24 hours
      expect(
        isAutoSyncDue({
          enabled: true,
          lastSyncAt: lastSync,
          intervalHours: 24,
          now,
        })
      ).toBe(true);
    });
  });

  describe("scheduleBase", () => {
    it("returns null when both dates are null", () => {
      expect(scheduleBase({ lastSyncAt: null, autoSyncLastRunAt: null })).toBeNull();
    });

    it("returns lastSyncAt when autoSyncLastRunAt is null", () => {
      const d = new Date("2026-08-21T10:00:00Z");
      expect(scheduleBase({ lastSyncAt: d, autoSyncLastRunAt: null })).toEqual(d);
    });

    it("returns autoSyncLastRunAt when lastSyncAt is null", () => {
      const d = new Date("2026-08-21T10:00:00Z");
      expect(scheduleBase({ lastSyncAt: null, autoSyncLastRunAt: d })).toEqual(d);
    });

    it("returns the later of the two dates", () => {
      const earlier = new Date("2026-08-20T10:00:00Z");
      const later = new Date("2026-08-21T10:00:00Z");
      expect(scheduleBase({ lastSyncAt: earlier, autoSyncLastRunAt: later })).toEqual(later);
      expect(scheduleBase({ lastSyncAt: later, autoSyncLastRunAt: earlier })).toEqual(later);
    });
  });
});
