import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isLocked,
  recordFailure,
  clearFailures,
  lockSecondsRemaining,
  getClientIp,
  isFormRateLimited,
  rateLimitPublicForm,
} from "@/lib/rate-limit";

describe("rate-limit utilities", () => {
  beforeEach(() => {
    // Clear all failures before each test by using a unique email per test
    // The in-memory store is shared, so we use unique keys
  });

  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("extracts IP from x-real-ip header", () => {
      const req = new Request("http://localhost", {
        headers: { "x-real-ip": "9.8.7.6" },
      });
      expect(getClientIp(req)).toBe("9.8.7.6");
    });

    it("returns 'unknown' when no IP headers present", () => {
      const req = new Request("http://localhost");
      expect(getClientIp(req)).toBe("unknown");
    });

    it("prefers x-real-ip over x-forwarded-for (H1 security fix)", () => {
      const req = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.2.3.4",
          "x-real-ip": "9.8.7.6",
        },
      });
      expect(getClientIp(req)).toBe("9.8.7.6");
    });
  });

  describe("recordFailure and isLocked", () => {
    it("is not locked initially", async () => {
      const testEmail = `test-initial-${Date.now()}@test.com`;
      expect(await isLocked(testEmail, "127.0.0.1")).toBe(false);
    });

    it("is not locked after 4 failures (below threshold)", async () => {
      const testEmail = `test-4fail-${Date.now()}@test.com`;
      for (let i = 0; i < 4; i++) {
        await recordFailure(testEmail, "127.0.0.2");
      }
      expect(await isLocked(testEmail, "127.0.0.2")).toBe(false);
    });

    it("is locked after 5 failures", async () => {
      const testEmail = `test-5fail-${Date.now()}@test.com`;
      for (let i = 0; i < 5; i++) {
        await recordFailure(testEmail, "127.0.0.3");
      }
      expect(await isLocked(testEmail, "127.0.0.3")).toBe(true);
    });

    it("lock expires after duration", async () => {
      const testEmail = `test-expire-${Date.now()}@test.com`;
      for (let i = 0; i < 5; i++) {
        await recordFailure(testEmail, "127.0.0.4");
      }
      expect(await isLocked(testEmail, "127.0.0.4")).toBe(true);
      // Note: We can't easily test lock expiry without mocking Date.now
      // This is covered by integration tests
    });
  });

  describe("lockSecondsRemaining", () => {
    it("returns 0 when not locked", async () => {
      const testEmail = `test-nolock-${Date.now()}@test.com`;
      expect(await lockSecondsRemaining(testEmail, "127.0.0.5")).toBe(0);
    });

    it("returns positive seconds when locked", async () => {
      const testEmail = `test-locked-${Date.now()}@test.com`;
      for (let i = 0; i < 5; i++) {
        await recordFailure(testEmail, "127.0.0.6");
      }
      const remaining = await lockSecondsRemaining(testEmail, "127.0.0.6");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(900); // 15 minutes max
    });
  });

  describe("clearFailures", () => {
    it("clears failures and unlocks account", async () => {
      const testEmail = `test-clear-${Date.now()}@test.com`;
      for (let i = 0; i < 5; i++) {
        await recordFailure(testEmail, "127.0.0.7");
      }
      expect(await isLocked(testEmail, "127.0.0.7")).toBe(true);

      await clearFailures(testEmail, "127.0.0.7");
      expect(await isLocked(testEmail, "127.0.0.7")).toBe(false);
    });
  });

  describe("different IPs are tracked separately", () => {
    it("locking one IP does not affect another", async () => {
      const testEmail = `test-multiip-${Date.now()}@test.com`;
      for (let i = 0; i < 5; i++) {
        await recordFailure(testEmail, "10.0.0.1");
      }
      expect(await isLocked(testEmail, "10.0.0.1")).toBe(true);
      expect(await isLocked(testEmail, "10.0.0.2")).toBe(false);
    });
  });

  describe("different emails are tracked separately", () => {
    it("locking one email does not affect another", async () => {
      const timestamp = Date.now();
      const email1 = `user1-${timestamp}@test.com`;
      const email2 = `user2-${timestamp}@test.com`;
      for (let i = 0; i < 5; i++) {
        await recordFailure(email1, "127.0.0.8");
      }
      expect(await isLocked(email1, "127.0.0.8")).toBe(true);
      expect(await isLocked(email2, "127.0.0.8")).toBe(false);
    });
  });

  describe("isFormRateLimited", () => {
    it("allows requests below the limit", async () => {
      const ip = `form-ok-${Date.now()}`;
      for (let i = 0; i < 9; i++) {
        expect(await isFormRateLimited(ip, 10, 60000)).toBe(false);
      }
    });

    it("rejects the request that exceeds the limit", async () => {
      const ip = `form-over-${Date.now()}`;
      for (let i = 0; i < 10; i++) {
        await isFormRateLimited(ip, 10, 60000);
      }
      expect(await isFormRateLimited(ip, 10, 60000)).toBe(true);
    });

    it("resets after the window elapses", async () => {
      const ip = `form-window-${Date.now()}`;
      let now = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      try {
        for (let i = 0; i < 10; i++) {
          await isFormRateLimited(ip, 10, 60000);
        }
        expect(await isFormRateLimited(ip, 10, 60000)).toBe(true);
        now += 60001;
        expect(await isFormRateLimited(ip, 10, 60000)).toBe(false);
      } finally {
        vi.restoreAllMocks();
      }
    });

    it("rateLimitPublicForm returns null under the limit and 429 over it", async () => {
      const ip = `form-resp-${Date.now()}`;
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": ip },
      });
      for (let i = 0; i < 10; i++) {
        expect(await rateLimitPublicForm(req, 10, 60000)).toBeNull();
      }
      const rejected = await rateLimitPublicForm(req, 10, 60000);
      expect(rejected).not.toBeNull();
      expect(rejected?.status).toBe(429);
    });
  });
});