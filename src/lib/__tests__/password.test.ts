import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isHashed } from "@/lib/password";

describe("password utilities", () => {
  describe("hashPassword", () => {
    it("returns a string in salt:hash format", () => {
      const result = hashPassword("test123");
      expect(result).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    });

    it("produces different hashes for the same password (random salt)", () => {
      const hash1 = hashPassword("test123");
      const hash2 = hashPassword("test123");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("returns true for correct password", () => {
      const stored = hashPassword("mypassword");
      expect(verifyPassword("mypassword", stored)).toBe(true);
    });

    it("returns false for wrong password", () => {
      const stored = hashPassword("mypassword");
      expect(verifyPassword("wrongpassword", stored)).toBe(false);
    });

    it("returns false for empty string", () => {
      const stored = hashPassword("mypassword");
      expect(verifyPassword("", stored)).toBe(false);
    });

    it("returns false for string without colon separator", () => {
      expect(verifyPassword("test", "invalidhash")).toBe(false);
    });

    it("returns false for empty stored string", () => {
      expect(verifyPassword("test", "")).toBe(false);
    });

    it("returns false for malformed stored value (empty parts)", () => {
      expect(verifyPassword("test", ":")).toBe(false);
    });
  });

  describe("isHashed", () => {
    it("returns true for valid scrypt hash format", () => {
      const stored = hashPassword("test");
      expect(isHashed(stored)).toBe(true);
    });

    it("returns false for plaintext password", () => {
      expect(isHashed("admin123")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isHashed("")).toBe(false);
    });

    it("returns false for string without colon", () => {
      expect(isHashed("no-colon-here")).toBe(false);
    });

    it("returns false for hash with wrong lengths", () => {
      // salt too short
      expect(isHashed("abc:def")).toBe(false);
    });
  });
});
