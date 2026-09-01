import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: { dapodikConfig: {} } }));

import {
  extractBridgeToken,
  generateBridgeToken,
  hashBridgeToken,
  parseBearerToken,
  verifyBridgeToken,
} from "@/lib/dapodik-bridge";
import { buildZipStore } from "@/lib/zip-store";
import { getJembatanFiles, JEMBATAN_FILE_NAMES } from "@/lib/dapodik-jembatan-files";

describe("bridge token", () => {
  it("menghasilkan token monsa_br_ dan hash SHA-256", () => {
    const { token, hash, prefix } = generateBridgeToken();
    expect(token.startsWith("monsa_br_")).toBe(true);
    expect(token.length).toBeGreaterThan(20);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(prefix).toBe(token.slice(0, 16));
    expect(hashBridgeToken(token)).toBe(hash);
  });

  it("verifyBridgeToken menerima token yang cocok dan menolak yang lain", () => {
    const { token, hash } = generateBridgeToken();
    expect(verifyBridgeToken(token, hash)).toBe(true);
    expect(verifyBridgeToken(token + "x", hash)).toBe(false);
    expect(verifyBridgeToken("", hash)).toBe(false);
    expect(verifyBridgeToken(token, "")).toBe(false);
  });

  it("dua generate menghasilkan token berbeda", () => {
    const a = generateBridgeToken();
    const b = generateBridgeToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("parseBearerToken / extractBridgeToken", () => {
  it("membaca Authorization: Bearer", () => {
    expect(parseBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(parseBearerToken("bearer xyz")).toBe("xyz");
    expect(parseBearerToken("Basic abc")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it("fallback ke header x-bridge-token", () => {
    const req = {
      headers: new Headers({ "x-bridge-token": "monsa_br_abc" }),
    };
    expect(extractBridgeToken(req)).toBe("monsa_br_abc");
  });

  it("Authorization menang atas x-bridge-token", () => {
    const req = {
      headers: new Headers({
        Authorization: "Bearer from-auth",
        "x-bridge-token": "from-alt",
      }),
    };
    expect(extractBridgeToken(req)).toBe("from-auth");
  });
});

describe("zip store + paket jembatan", () => {
  it("ZIP STORE memuat nama file dan magic number", () => {
    const zip = buildZipStore([
      { name: "README.txt", content: "halo" },
      { name: "jalankan.bat", content: "@echo off\r\n" },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const asString = zip.toString("binary");
    expect(asString).toContain("README.txt");
    expect(asString).toContain("jalankan.bat");
    expect(zip.length).toBeGreaterThan(80);
  });

  it("paket jembatan berisi keempat berkas", () => {
    const files = getJembatanFiles();
    expect(files.map((f) => f.name)).toEqual([...JEMBATAN_FILE_NAMES]);
    const mjs = files.find((f) => f.name === "jembatan.mjs")?.content ?? "";
    expect(mjs).toContain("127.0.0.1");
    expect(mjs).toContain("/api/dapodik/ingest");
    expect(mjs).toContain("getPesertaDidik");
    const bat = files.find((f) => f.name === "jalankan.bat")?.content ?? "";
    expect(bat).toMatch(/Jembatan-Dapodik\.ps1/);
  });
});
