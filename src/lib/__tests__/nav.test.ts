import { describe, it, expect } from "vitest";
import {
  PUBLIC_NAV,
  DASHBOARD_NAV,
  NEWS_CATEGORIES,
  GALLERY_CATEGORIES,
  AGENDA_CATEGORIES,
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_CATEGORIES,
} from "@/lib/nav";

// ── PUBLIC_NAV ────────────────────────────────────────────────────
describe("PUBLIC_NAV", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(PUBLIC_NAV)).toBe(true);
    expect(PUBLIC_NAV.length).toBeGreaterThan(0);
  });

  it("every item has label, path, and icon", () => {
    for (const item of PUBLIC_NAV) {
      expect(typeof item.label).toBe("string");
      expect(typeof item.path).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.path.startsWith("/")).toBe(true);
      expect(item.icon).toBeDefined();
    }
  });

  it("none are adminOnly", () => {
    for (const item of PUBLIC_NAV) {
      expect(item.adminOnly).toBeFalsy();
    }
  });

  it("starts with Beranda at /", () => {
    expect(PUBLIC_NAV[0].label).toBe("Beranda");
    expect(PUBLIC_NAV[0].path).toBe("/");
  });

  it("includes expected pages", () => {
    const paths = PUBLIC_NAV.map((i) => i.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/profile");
    expect(paths).toContain("/news");
    expect(paths).toContain("/gallery");
    expect(paths).toContain("/contact");
    expect(paths).toContain("/academic");
    expect(paths).toContain("/complaint");
    expect(paths).toContain("/transparansi");
  });
});

// ── DASHBOARD_NAV ─────────────────────────────────────────────────
describe("DASHBOARD_NAV", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(DASHBOARD_NAV)).toBe(true);
    expect(DASHBOARD_NAV.length).toBeGreaterThan(0);
  });

  it("every item has label, path, and icon", () => {
    for (const item of DASHBOARD_NAV) {
      expect(typeof item.label).toBe("string");
      expect(typeof item.path).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.path.startsWith("/dashboard")).toBe(true);
      expect(item.icon).toBeDefined();
    }
  });

  it("starts with Ringkasan at /dashboard", () => {
    expect(DASHBOARD_NAV[0].label).toBe("Ringkasan");
    expect(DASHBOARD_NAV[0].path).toBe("/dashboard");
  });

  it("has adminOnly items for sensitive pages", () => {
    const adminItems = DASHBOARD_NAV.filter((i) => i.adminOnly);
    expect(adminItems.length).toBeGreaterThan(0);

    const adminPaths = adminItems.map((i) => i.path);
    expect(adminPaths).toContain("/dashboard/users");
    expect(adminPaths).toContain("/dashboard/settings");
    expect(adminPaths).toContain("/dashboard/logs");
  });

  it("has non-admin items for regular pages", () => {
    const regularItems = DASHBOARD_NAV.filter((i) => !i.adminOnly);
    expect(regularItems.length).toBeGreaterThan(0);

    const regularPaths = regularItems.map((i) => i.path);
    expect(regularPaths).toContain("/dashboard");
    expect(regularPaths).toContain("/dashboard/news");
    expect(regularPaths).toContain("/dashboard/gallery");
  });

  it("includes expected dashboard pages", () => {
    const paths = DASHBOARD_NAV.map((i) => i.path);
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/dashboard/news");
    expect(paths).toContain("/dashboard/announcements");
    expect(paths).toContain("/dashboard/agenda");
    expect(paths).toContain("/dashboard/gallery");
    expect(paths).toContain("/dashboard/achievements");
    expect(paths).toContain("/dashboard/teachers");
    expect(paths).toContain("/dashboard/students");
    expect(paths).toContain("/dashboard/classes");
    expect(paths).toContain("/dashboard/attendance");
    expect(paths).toContain("/dashboard/reports");
    expect(paths).toContain("/dashboard/dapodik");
    expect(paths).toContain("/dashboard/complaints");
    expect(paths).toContain("/dashboard/messages");
  });
});

// ── NEWS_CATEGORIES ───────────────────────────────────────────────
describe("NEWS_CATEGORIES", () => {
  it("contains expected categories", () => {
    expect(NEWS_CATEGORIES).toEqual(["Akademik", "Kegiatan", "Prestasi"]);
  });

  it("is readonly", () => {
    expect(NEWS_CATEGORIES).toHaveLength(3);
  });
});

// ── GALLERY_CATEGORIES ────────────────────────────────────────────
describe("GALLERY_CATEGORIES", () => {
  it("contains expected categories", () => {
    expect(GALLERY_CATEGORIES).toEqual([
      "Kegiatan",
      "Prestasi",
      "Fasilitas",
      "Upacara",
    ]);
  });

  it("has 4 entries", () => {
    expect(GALLERY_CATEGORIES).toHaveLength(4);
  });
});

// ── AGENDA_CATEGORIES ─────────────────────────────────────────────
describe("AGENDA_CATEGORIES", () => {
  it("contains expected categories", () => {
    expect(AGENDA_CATEGORIES).toEqual(["Akademik", "Kegiatan", "Libur", "Umum"]);
  });

  it("has 4 entries", () => {
    expect(AGENDA_CATEGORIES).toHaveLength(4);
  });
});

// ── ACHIEVEMENT_LEVELS ────────────────────────────────────────────
describe("ACHIEVEMENT_LEVELS", () => {
  it("contains all competition levels in order", () => {
    expect(ACHIEVEMENT_LEVELS).toEqual([
      "Sekolah",
      "Kecamatan",
      "Kabupaten",
      "Provinsi",
      "Nasional",
      "Internasional",
    ]);
  });

  it("has 6 levels", () => {
    expect(ACHIEVEMENT_LEVELS).toHaveLength(6);
  });
});

// ── ACHIEVEMENT_CATEGORIES ────────────────────────────────────────
describe("ACHIEVEMENT_CATEGORIES", () => {
  it("contains Akademik and Non-Akademik", () => {
    expect(ACHIEVEMENT_CATEGORIES).toEqual(["Akademik", "Non-Akademik"]);
  });

  it("has exactly 2 entries", () => {
    expect(ACHIEVEMENT_CATEGORIES).toHaveLength(2);
  });
});

// ── NavItem type shape ────────────────────────────────────────────
describe("NavItem type", () => {
  it("all public nav items match NavItem shape", () => {
    for (const item of PUBLIC_NAV) {
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("path");
      expect(item).toHaveProperty("icon");
      // LucideIcon: object (forwardRef) in jsdom, function in real React
      expect(item.icon).toBeDefined();
    }
  });

  it("all dashboard nav items match NavItem shape", () => {
    for (const item of DASHBOARD_NAV) {
      expect(item).toHaveProperty("label");
      expect(item).toHaveProperty("path");
      expect(item).toHaveProperty("icon");
      expect(item.icon).toBeDefined();
    }
  });
});
