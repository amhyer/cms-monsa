import { describe, it, expect } from "vitest";
import { isGuruDeniedPath } from "@/lib/access";

/**
 * Regression tests for the GURU dashboard guard (REFACTOR_PLAN #1 fix):
 * `/dashboard` must be exact-match, never prefix-match — otherwise
 * `/dashboard/news` etc. would leak to GURU (the e2e-caught security bug).
 */
describe("isGuruDeniedPath (GURU dashboard guard)", () => {
  describe("allowed paths (returns false — GURU may access)", () => {
    it("allows exact /dashboard (Ringkasan)", () => {
      expect(isGuruDeniedPath("/dashboard")).toBe(false);
    });

    it("allows exact /dashboard/attendance (Kehadiran)", () => {
      expect(isGuruDeniedPath("/dashboard/attendance")).toBe(false);
    });

    it("allows /dashboard/attendance/... sub-pages (future-proof)", () => {
      expect(isGuruDeniedPath("/dashboard/attendance/report")).toBe(false);
      expect(isGuruDeniedPath("/dashboard/attendance/2026-08-01")).toBe(false);
    });

    it("allows exact /dashboard/profile (Profil Saya)", () => {
      expect(isGuruDeniedPath("/dashboard/profile")).toBe(false);
    });

    it("denies /dashboard/profile/... sub-paths (only exact page allowed)", () => {
      expect(isGuruDeniedPath("/dashboard/profile/edit")).toBe(true);
      expect(isGuruDeniedPath("/dashboard/profilex")).toBe(true);
    });
  });

  describe("denied paths (returns true — GURU must be blocked)", () => {
    it("denies /dashboard/news (the original prefix-match leak)", () => {
      // Regression: with prefix-match on "/dashboard", this was `false`.
      expect(isGuruDeniedPath("/dashboard/news")).toBe(true);
    });

    it("denies every other content/management module", () => {
      const denied = [
        "/dashboard/announcements",
        "/dashboard/agenda",
        "/dashboard/gallery",
        "/dashboard/achievements",
        "/dashboard/teachers",
        "/dashboard/students",
        "/dashboard/classes",
        "/dashboard/payments",
        "/dashboard/reports",
        "/dashboard/complaints",
        "/dashboard/messages",
      ];
      for (const path of denied) {
        expect(isGuruDeniedPath(path), path).toBe(true);
      }
    });

    it("denies admin-only modules (users/settings/logs)", () => {
      for (const path of ["/dashboard/users", "/dashboard/settings", "/dashboard/logs"]) {
        expect(isGuruDeniedPath(path), path).toBe(true);
      }
    });

    it("does not falsely allow lookalike prefixes (/dashboard/attendancex)", () => {
      // Prefix-match on "/dashboard/attendance" would pass this — the guard
      // requires the trailing slash segment.
      expect(isGuruDeniedPath("/dashboard/attendancex")).toBe(true);
      expect(isGuruDeniedPath("/dashboard/attendance-extra")).toBe(true);
    });

    it("treats raw path-traversal strings under the allowed prefix as allowed", () => {
      // Documenting actual pure-function behavior: "/dashboard/attendance/../../news"
      // STARTS WITH the allowed prefix, so the guard returns false (allowed).
      // This is safe in practice because Next.js App Router normalizes ".."
      // segments before usePathname() ever returns a pathname — the guard only
      // ever receives already-normalized paths.
      expect(isGuruDeniedPath("/dashboard/attendance/../../news")).toBe(false);
      expect(isGuruDeniedPath("/dashboard/attendance/../users")).toBe(false);
    });

    it("denies root/parent paths and unrelated routes", () => {
      expect(isGuruDeniedPath("/")).toBe(true);
      expect(isGuruDeniedPath("/dashboard/")).toBe(true); // trailing slash ≠ exact
      expect(isGuruDeniedPath("/dashboardx")).toBe(true);
      expect(isGuruDeniedPath("/dashboard2")).toBe(true);
      expect(isGuruDeniedPath("/login")).toBe(true);
      expect(isGuruDeniedPath("/profile")).toBe(true);
      expect(isGuruDeniedPath("")).toBe(true);
    });
  });
});
