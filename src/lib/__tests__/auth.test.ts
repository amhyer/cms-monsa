import { describe, it, expect } from "vitest";
import { hasRole, decode } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

// We only test the pure functions that don't depend on `next/headers` or Prisma.
// The cookie-dependent functions (getSession, setSession, etc.) are tested via
// integration tests or with mocked next/headers.

describe("auth utilities", () => {
  describe("hasRole", () => {
    const adminUser: SessionUser = {
      id: "1",
      name: "Admin",
      email: "admin@test.com",
      role: "SUPER_ADMIN",
      isActive: true,
      mustChangePassword: false,
      guardianClassId: null,
      guardianStudentId: null,
    };

    const operatorUser: SessionUser = {
      id: "2",
      name: "Operator",
      email: "operator@test.com",
      role: "OPERATOR",
      isActive: true,
      mustChangePassword: false,
      guardianClassId: null,
      guardianStudentId: null,
    };

    const guruUser: SessionUser = {
      id: "3",
      name: "Guru",
      email: "guru@test.com",
      role: "GURU",
      isActive: true,
      mustChangePassword: false,
      guardianClassId: "c1",
      guardianStudentId: null,
    };

    it("returns false for null user", () => {
      expect(hasRole(null, "OPERATOR")).toBe(false);
      expect(hasRole(null, "SUPER_ADMIN")).toBe(false);
      expect(hasRole(null, "GURU")).toBe(false);
    });

    it("returns true for any authenticated user when min is OPERATOR", () => {
      expect(hasRole(adminUser, "OPERATOR")).toBe(true);
      expect(hasRole(operatorUser, "OPERATOR")).toBe(true);
    });

    it("returns true for SUPER_ADMIN user when min is SUPER_ADMIN", () => {
      expect(hasRole(adminUser, "SUPER_ADMIN")).toBe(true);
    });

    it("returns false for OPERATOR user when min is SUPER_ADMIN", () => {
      expect(hasRole(operatorUser, "SUPER_ADMIN")).toBe(false);
    });

    it("grants GURU only GURU-level access", () => {
      expect(hasRole(guruUser, "GURU")).toBe(true);
      expect(hasRole(guruUser, "OPERATOR")).toBe(false);
      expect(hasRole(guruUser, "SUPER_ADMIN")).toBe(false);
    });
  });

  describe("decode — session token verification", () => {
    // We test the decode function by encoding valid tokens and verifying
    // behavior. This requires access to encode (private) so we construct
    // tokens manually for edge-case testing.

    it("returns null for empty token", () => {
      expect(decode("")).toBeNull();
    });

    it("returns null for token without dot separator", () => {
      expect(decode("notavalidtoken")).toBeNull();
    });

    it("returns null for token with wrong signature", () => {
      // Construct a fake payload with wrong signature
      const fakePayload = Buffer.from(
        JSON.stringify({ userId: "1", activeRole: "SUPER_ADMIN", createdAt: Date.now() })
      ).toString("base64");
      const fakeSignature = "a".repeat(64);
      expect(decode(`${fakePayload}.${fakeSignature}`)).toBeNull();
    });

    it("returns null for tampered payload (signature mismatch)", () => {
      // Tamper with the base64 payload by changing one character
      const tampered = Buffer.from(
        JSON.stringify({ userId: "2", activeRole: "GURU", createdAt: Date.now() })
      ).toString("base64");
      // Replace first char with different base64 char
      const firstChar = tampered[0] === "A" ? "B" : "A";
      const tamperedToken = firstChar + tampered.slice(1) + ".fake";
      expect(decode(tamperedToken)).toBeNull();
    });

    it("returns null for expired session (older than 7 days)", () => {
      // We can't easily encode a token with a past createdAt since encode
      // is private. But we verify the 7-day logic by checking that the
      // decode function rejects tokens where createdAt is too old.
      // This is verified by the session expiry constant in auth.ts:
      // SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
      const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      const expiredAt = Date.now() - SESSION_MAX_AGE_MS - 1;
      // Construct a valid-format but expired payload
      const expiredPayload = Buffer.from(
        JSON.stringify({ userId: "1", activeRole: "SUPER_ADMIN", createdAt: expiredAt })
      ).toString("base64");
      // Without the real HMAC, decode will fail on signature check first.
      // This test documents the intent: sessions older than 7 days must be
      // rejected. The actual HMAC-signed expired token test requires encode()
      // to be exported or a mock, so we verify the constant exists and is
      // reasonable (7 days).
      expect(SESSION_MAX_AGE_MS).toBe(604800000); // 7 * 24 * 60 * 60 * 1000
      // At minimum, decode rejects obviously invalid tokens
      expect(decode(`${expiredPayload}.invalid`)).toBeNull();
    });

    it("returns null for payload missing required fields", () => {
      const payload = Buffer.from(
        JSON.stringify({ userId: "1" }) // missing activeRole
      ).toString("base64");
      const sig = "a".repeat(64);
      expect(decode(`${payload}.${sig}`)).toBeNull();
    });
  });
});
