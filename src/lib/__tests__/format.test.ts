import { describe, it, expect } from "vitest";
import {
  slugify,
  formatDate,
  formatDateTime,
  relativeTime,
  readingTime,
  truncate,
  parseDateInput,
} from "@/lib/format";

describe("format utilities", () => {
  describe("slugify", () => {
    it("converts text to lowercase slug", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });

    it("removes special characters", () => {
      expect(slugify("Berita & Pengumuman!")).toBe("berita-pengumuman");
    });

    it("handles multiple spaces", () => {
      expect(slugify("  Hello   World  ")).toBe("hello-world");
    });

    it("handles multiple dashes", () => {
      expect(slugify("hello---world")).toBe("hello-world");
    });

    it("truncates at 80 characters", () => {
      const long = "a".repeat(100);
      expect(slugify(long)).toHaveLength(80);
    });

    it("removes non-alphanumeric characters except spaces and dashes", () => {
      expect(slugify("Hello! @World# $%^")).toBe("hello-world-");
    });

    it("handles Indonesian characters", () => {
      expect(slugify("Pengumuman SBMPTN 2024")).toBe("pengumuman-sbmptn-2024");
    });
  });

  describe("formatDate", () => {
    it("returns '-' for null", () => {
      expect(formatDate(null)).toBe("-");
    });

    it("returns '-' for invalid date string", () => {
      expect(formatDate("not-a-date")).toBe("-");
    });

    it("formats valid date string in Indonesian", () => {
      const result = formatDate("2026-07-30");
      expect(result).toContain("2026");
      expect(result).toContain("Juli");
    });

    it("formats Date object", () => {
      const d = new Date(2026, 0, 15); // Jan 15, 2026
      const result = formatDate(d);
      expect(result).toContain("15");
      expect(result).toContain("Januari");
      expect(result).toContain("2026");
    });
  });

  describe("formatDateTime", () => {
    it("returns '-' for null", () => {
      expect(formatDateTime(null)).toBe("-");
    });

    it("returns '-' for invalid date", () => {
      expect(formatDateTime("invalid")).toBe("-");
    });

    it("includes time in output", () => {
      const result = formatDateTime("2026-07-30T10:30:00");
      expect(result).toContain("2026");
      expect(result).toContain("10");
    });
  });

  describe("relativeTime", () => {
    it("returns '-' for null", () => {
      expect(relativeTime(null)).toBe("-");
    });

    it("returns '-' for invalid date", () => {
      expect(relativeTime("invalid")).toBe("-");
    });

    it("returns 'baru saja' for very recent time", () => {
      const now = new Date();
      expect(relativeTime(now)).toBe("baru saja");
    });

    it("returns minutes ago", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(relativeTime(fiveMinAgo)).toBe("5 menit lalu");
    });

    it("returns hours ago", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(relativeTime(threeHoursAgo)).toBe("3 jam lalu");
    });

    it("returns days ago", () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      expect(relativeTime(fiveDaysAgo)).toBe("5 hari lalu");
    });

    it("returns formatted date for old dates", () => {
      const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const result = relativeTime(twoMonthsAgo);
      // Should fall back to formatDate
      expect(result).not.toBe("baru saja");
      expect(result).not.toMatch(/lalu/);
    });
  });

  describe("readingTime", () => {
    it("returns '1 menit baca' for short text", () => {
      expect(readingTime("Hello world")).toBe("1 menit baca");
    });

    it("calculates reading time for longer content", () => {
      const words = Array(400).fill("word").join(" ");
      expect(readingTime(words)).toBe("2 menit baca");
    });

    it("calculates reading time for 600 words", () => {
      const words = Array(600).fill("word").join(" ");
      expect(readingTime(words)).toBe("3 menit baca");
    });
  });

  describe("truncate", () => {
    it("returns original text if shorter than max", () => {
      expect(truncate("short", 10)).toBe("short");
    });

    it("returns original text if equal to max", () => {
      expect(truncate("exactly10!", 10)).toBe("exactly10!");
    });

    it("truncates and adds ellipsis", () => {
      const result = truncate("this is a very long text", 10);
      expect(result.length).toBeLessThanOrEqual(11); // 10 chars + ellipsis
      expect(result).toContain("…");
    });
  });

  describe("parseDateInput", () => {
    it("parses date-only string as noon local", () => {
      const d = parseDateInput("2026-12-15");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(11); // December
      expect(d.getDate()).toBe(15);
      expect(d.getHours()).toBe(12); // noon
    });

    it("preserves full ISO timestamps", () => {
      const d = parseDateInput("2026-12-15T10:30:00Z");
      expect(d.toISOString()).toBe("2026-12-15T10:30:00.000Z");
    });

    it("returns current date for empty string", () => {
      const before = Date.now();
      const d = parseDateInput("");
      const after = Date.now();
      expect(d.getTime()).toBeGreaterThanOrEqual(before);
      expect(d.getTime()).toBeLessThanOrEqual(after);
    });

    it("handles invalid date string gracefully", () => {
      const d = parseDateInput("not-a-date");
      // Should return current date as fallback
      expect(d).toBeInstanceOf(Date);
    });
  });
});
