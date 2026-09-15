import { describe, it, expect, vi } from "vitest";
import {
  sanitizeIntervalHours,
  isAutoSyncDue,
  scheduleBase,
  MIN_INTERVAL_HOURS,
  MAX_INTERVAL_HOURS,
  DEFAULT_INTERVAL_HOURS,
} from "../dapodik-scheduler";
import { isTransientDbError, withDbRetry } from "../db-retry";

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

  describe("isTransientDbError", () => {
    it("recognizes Prisma pool timeout (cold-start Neon)", () => {
      const err = new Error(
        "Invalid `prisma.dapodikConfig.findUnique()` invocation: Timed out fetching a new connection from the connection pool (Current connection pool timeout: 10, connection limit: 5)"
      );
      err.name = "PrismaClientInitializationError";
      expect(isTransientDbError(err)).toBe(true);
    });

    it("recognizes connection refused / reset / timeout", () => {
      for (const msg of ["ECONNREFUSED connect", "ECONNRESET socket hang up", "connection timed out", "P1001 Can't reach database server"]) {
        expect(isTransientDbError(new Error(msg))).toBe(true);
      }
    });

    it("rejects non-DB / non-transient errors", () => {
      expect(isTransientDbError(new Error("P2025 Record not found"))).toBe(false);
      expect(isTransientDbError(new Error("User not authorized"))).toBe(false);
      expect(isTransientDbError(null)).toBe(false);
      expect(isTransientDbError("plain string")).toBe(false);
    });
  });

  describe("withDbRetry", () => {
    it("succeeds on first attempt without retry", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      await expect(withDbRetry(fn, { baseDelayMs: 0 })).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries transient errors and succeeds", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Timed out fetching a new connection from the connection pool"))
        .mockRejectedValueOnce(new Error("Timed out fetching a new connection from the connection pool"))
        .mockResolvedValue("ok");
      await expect(withDbRetry(fn, { baseDelayMs: 0 })).resolves.toBe("ok");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("throws immediately on non-transient error", async () => {
      const err = new Error("P2025 Record not found");
      const fn = vi.fn().mockRejectedValue(err);
      await expect(withDbRetry(fn, { baseDelayMs: 0 })).rejects.toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("gives up after max attempts for persistent transient errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new Error("Timed out fetching a new connection from the connection pool"));
      await expect(withDbRetry(fn, { attempts: 2, baseDelayMs: 0 })).rejects.toMatchObject({
        message: expect.stringContaining("Timed out"),
      });
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
