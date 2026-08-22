import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  parsePaginationParams,
  buildPaginatedResponse,
} from "../pagination";

describe("pagination utilities", () => {
  describe("encodeCursor / decodeCursor", () => {
    it("encodes and decodes cursor correctly", () => {
      const id = "user-123";
      const encoded = encodeCursor(id);
      expect(encoded).toBeTruthy();
      expect(decodeCursor(encoded)).toBe(id);
    });

    it("returns null for invalid cursor", () => {
      expect(decodeCursor(null)).toBeNull();
      expect(decodeCursor("")).toBeNull();
      // Note: base64url is very permissive — most strings decode.
      // We test empty string and null which are the meaningful invalid cases.
    });

    it("handles special characters in ID", () => {
      const id = "user/123+456=";
      const encoded = encodeCursor(id);
      expect(decodeCursor(encoded)).toBe(id);
    });
  });

  describe("parsePaginationParams", () => {
    it("returns default limit when not specified", () => {
      const params = new URLSearchParams({});
      const result = parsePaginationParams(params, 20, 100);
      expect(result.limit).toBe(20);
      expect(result.cursor).toBeNull();
    });

    it("clamps limit to max", () => {
      const params = new URLSearchParams({ limit: "999" });
      const result = parsePaginationParams(params, 20, 100);
      expect(result.limit).toBe(100);
    });

    it("clamps limit to minimum 1", () => {
      const params = new URLSearchParams({ limit: "0" });
      const result = parsePaginationParams(params, 20, 100);
      expect(result.limit).toBe(1);
    });

    it("extracts cursor from params", () => {
      const cursor = encodeCursor("abc");
      const params = new URLSearchParams({ cursor });
      const result = parsePaginationParams(params, 20, 100);
      expect(result.cursor).toBe(cursor);
    });
  });

  describe("buildPaginatedResponse", () => {
    it("returns hasMore=false when items <= limit", () => {
      const items = [{ id: "1" }, { id: "2" }];
      const result = buildPaginatedResponse(items, 2, 10);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(2);
    });

    it("returns hasMore=true and trims when items > limit", () => {
      const items = Array.from({ length: 11 }, (_, i) => ({
        id: `item-${i}`,
      }));
      const result = buildPaginatedResponse(items, 20, 10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeTruthy();
      expect(result.items).toHaveLength(10);
      // Cursor should encode the last item's ID
      expect(decodeCursor(result.nextCursor!)).toBe("item-9");
    });

    it("returns empty response correctly", () => {
      const result = buildPaginatedResponse([], 0, 10);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
