import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("paket jembatan berisi keempat berkas dan form konfigurasi", () => {
    const files = getJembatanFiles();
    expect(files.map((f) => f.name)).toEqual([...JEMBATAN_FILE_NAMES]);
    const mjs = files.find((f) => f.name === "jembatan.mjs")?.content ?? "";
    expect(mjs).toContain("127.0.0.1");
    expect(mjs).toContain("/api/dapodik/ingest");
    expect(mjs).toContain("getPesertaDidik");
    expect(mjs).toContain('id="npsn"');
    expect(mjs).toContain('id="token"');
    const bat = files.find((f) => f.name === "jalankan.bat")?.content ?? "";
    expect(bat).toContain('node "%~dp0jembatan.mjs"');
    expect(bat).toMatch(/pause/i);
  });

  it("jembatan.mjs dapat dijalankan langsung oleh Node", async () => {
    const mjs = getJembatanFiles().find((f) => f.name === "jembatan.mjs")?.content ?? "";
    const dir = await mkdtemp(join(tmpdir(), "cms-monsa-jembatan-"));
    const entry = join(dir, "jembatan.mjs");
    await writeFile(entry, mjs, "utf8");

    const child = spawn(process.execPath, [entry], {
      env: { ...process.env, JEMBATAN_PORT: "0", JEMBATAN_NO_BROWSER: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Jembatan tidak siap dalam 5 detik. Output: ${output}`));
        }, 5_000);
        const collect = (chunk: Buffer) => {
          output += chunk.toString("utf8");
          if (output.includes("Jembatan Dapodik siap")) {
            clearTimeout(timer);
            resolve();
          }
        };
        child.stdout.on("data", collect);
        child.stderr.on("data", collect);
        child.once("exit", (code) => {
          clearTimeout(timer);
          if (!output.includes("Jembatan Dapodik siap")) {
            reject(new Error(`Jembatan berhenti (kode ${code}). Output: ${output}`));
          }
        });
      });

      expect(output).toContain("Jembatan Dapodik siap");
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([
          once(child, "exit"),
          new Promise((resolve) => setTimeout(resolve, 2_000)),
        ]);
      }
      await rm(dir, { recursive: true, force: true });
    }
  });
});
