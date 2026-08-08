import { describe, it, expect } from "vitest";
import { hasRole } from "@/lib/auth";
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
      guardianClassId: null,
    guardianStudentId: null,
    };

    const operatorUser: SessionUser = {
      id: "2",
      name: "Operator",
      email: "operator@test.com",
      role: "OPERATOR",
      isActive: true,
      guardianClassId: null,
    guardianStudentId: null,
    };

    const guruUser: SessionUser = {
      id: "3",
      name: "Guru",
      email: "guru@test.com",
      role: "GURU",
      isActive: true,
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
});
