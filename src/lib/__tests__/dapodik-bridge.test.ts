import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
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

  it("paket jembatan berisi semua launcher dan form konfigurasi", () => {
    const files = getJembatanFiles();
    expect(files.map((f) => f.name)).toEqual([...JEMBATAN_FILE_NAMES]);
    const mjs = files.find((f) => f.name === "jembatan.mjs")?.content ?? "";
    expect(mjs).toContain("127.0.0.1");
    expect(mjs).toContain("/api/dapodik/ingest");
    expect(mjs).toContain("getPesertaDidik");
    expect(mjs).toContain('id="npsn"');
    expect(mjs).toContain('id="token"');
    const vbs = files.find((f) => f.name === "MULAI-JEMBATAN.vbs")?.content ?? "";
    expect(vbs).toContain("cmd.exe /k");
    expect(vbs).toContain("node jembatan.mjs");
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

// ----------------------------------------------------------------
// syncChunked — regresi angka ringkasan (created/updated) di CI.
// Menjalankan jembatan.mjs NYATA (dari bundle) dengan Dapodik & CMS
// di-mock via HTTP lokal, lalu memverifikasi ringkasan yang dikembalikan
// oleh rute /api/sync dan /api/preview. Menangkap regresi seperti bug
// siswaTotals.created yang dulu selalu 0 pada jalur multi-batch.
// ----------------------------------------------------------------

/** Ambil port kosong lalu tutup — untuk bind server mock/jembatan. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

interface MockCms {
  server: Server;
  port: number;
  ingest: { dataType: string; payloadSize: number; mode: string }[];
  archive: { pesertaDidikIds: string[]; gtkIds: string[] } | null;
}

/** Mock CMS: meniru respons modular /api/dapodik/ingest + /api/dapodik/archive. */
async function startMockCms(): Promise<MockCms> {
  const ingest: MockCms["ingest"] = [];
  const state: Pick<MockCms, "archive"> = { archive: null };
  const port = await freePort();
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};
      res.setHeader("Content-Type", "application/json");
      if (url.pathname === "/api/dapodik/ingest") {
        const { dataType, payload } = body as { dataType: string; payload: unknown };
        const payloadSize = Array.isArray(payload) ? payload.length : 1;
        ingest.push({ dataType, payloadSize, mode: url.searchParams.get("mode") ?? "commit" });
        // Format respons MENIRU server asli (SyncResult): kunci "siswa" dipakai
        // untuk dataType apa pun (syncChunked membaca r.<dataType> -> r.siswa).
        const created = payloadSize;
        const mod = dataType === "sekolah" ? "sekolah" : dataType === "gtk" ? "gtk" : dataType === "rombel" ? "rombel" : "siswa";
        res.end(
          JSON.stringify({
            success: true,
            message: "ok",
            [mod]: dataType === "sekolah" ? { updated: 1, created: 0, errors: 0 } : { created, updated: 0, errors: 0 },
          })
        );
      } else if (url.pathname === "/api/dapodik/archive") {
        const { pesertaDidikIds, gtkIds } = body as { pesertaDidikIds: string[]; gtkIds: string[] };
        state.archive = { pesertaDidikIds, gtkIds };
        res.end(JSON.stringify({ success: true, siswaArchived: 0, gtkArchived: 0 }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not found" }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    server,
    port,
    ingest,
    // Getter — bukan salinan nilai saat init — agar state.archive yang diubah
    // handler request terlihat oleh pemanggil (regresi test pertama).
    get archive() {
      return state.archive;
    },
  };
}

/** Mock Dapodik WS: satu sekolah + N peserta didik (dengan pagination). */
async function startMockDapodik(totalSiswa: number): Promise<{ server: Server; port: number }> {
  const port = await freePort();
  const siswa = Array.from({ length: totalSiswa }, (_, i) => ({
    peserta_didik_id: `pd-${String(i).padStart(3, "0")}`,
    nama: `Siswa ${i + 1}`,
  }));
  const gtk = [
    { ptk_id: "gtk-001", nama: "Guru Satu", nuptk: "1111111111" },
    { ptk_id: "gtk-002", nama: "Guru Dua", nuptk: "2222222222" },
  ];
  const rombel = [{ rombongan_belajar_id: "rb-001", nama: "1-A" }];
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const ep = url.pathname.replace(/^\/WebService\//, "");
    res.setHeader("Content-Type", "application/json");
    if (ep === "getSekolah") {
      res.end(JSON.stringify({ rows: [{ npsn: "40313912", nama: "SD Uji" }] }));
    } else if (ep === "getPesertaDidik") {
      const start = Number(url.searchParams.get("start") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 100);
      const page = siswa.slice(start, start + limit);
      res.end(JSON.stringify({ rows: page, results: siswa.length }));
    } else if (ep === "getGtk") {
      res.end(JSON.stringify({ rows: gtk }));
    } else if (ep === "getRombonganBelajar") {
      res.end(JSON.stringify({ rows: rombel }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ rows: [] }));
    }
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { server, port };
}

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}

async function waitForBridge(base: string, output: () => string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (output().includes("Jembatan Dapodik siap")) return;
    try {
      const res = await fetch(`${base}/api/config`);
      if (res.ok) return;
    } catch {
      // belum siap — coba lagi
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Jembatan tidak siap. Output: ${output()}`);
}

interface BridgeHarness {
  base: string;
  cms: MockCms;
  cleanup: () => Promise<void>;
}

/**
 * Siapkan jembatan.mjs NYATA (dari bundle) + mock Dapodik & CMS di port
 * bebas, arahkan jembatan ke mock, dan kembalikan harness siap pakai.
 * Setiap test memanggil `cleanup()` di finally.
 */
async function startBridge(totalSiswa: number): Promise<BridgeHarness> {
  const cms = await startMockCms();
  const dapo = await startMockDapodik(totalSiswa);
  const bridgePort = await freePort();
  const mjs = getJembatanFiles().find((f) => f.name === "jembatan.mjs")?.content ?? "";
  const dir = await mkdtemp(join(tmpdir(), "cms-monsa-jembatan-sync-"));
  const entry = join(dir, "jembatan.mjs");
  await writeFile(entry, mjs, "utf8");

  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      JEMBATAN_PORT: String(bridgePort),
      JEMBATAN_NO_BROWSER: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (c) => (output += c.toString("utf8")));
  child.stderr.on("data", (c) => (output += c.toString("utf8")));

  const base = `http://127.0.0.1:${bridgePort}`;
  await waitForBridge(base, () => output);
  const put = await fetch(`${base}/api/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmsUrl: `http://127.0.0.1:${cms.port}`,
      bridgeToken: "monsa_br_test",
      npsn: "40313912",
      token: "test-token",
      host: "127.0.0.1",
      port: dapo.port,
    }),
  });
  if (!put.ok) {
    await stopChild(child);
    await stopServer(cms.server);
    await stopServer(dapo.server);
    await rm(dir, { recursive: true, force: true });
    throw new Error(`Konfigurasi jembatan gagal. Output: ${output}`);
  }

  const cleanup = async () => {
    await stopChild(child);
    await stopServer(cms.server);
    await stopServer(dapo.server);
    await rm(dir, { recursive: true, force: true });
  };
  return { base, cms, cleanup };
}

describe("syncChunked (jembatan.mjs nyata + mock HTTP)", () => {
  const TOTAL_SISWA = 103; // > 2×CHUNK (50) → memaksa 3 batch: 50/50/3

  type SyncSummary = {
    sekolah: { updated: number };
    siswa: { created: number; updated: number; archived: number };
    gtk: { created: number; archived: number };
    rombel: { created: number };
    _archive: { siswaArchived: number } | null;
  };

  it("menjumlahkan created per batch: 103 siswa -> 3 request -> created 103", async () => {
    const { base, cms, cleanup } = await startBridge(TOTAL_SISWA);
    try {
      // --- Jalur commit (/api/sync) ---
      const syncRes = await fetch(`${base}/api/sync`, { method: "POST" });
      const sync = (await syncRes.json()) as SyncSummary;
      expect(syncRes.status).toBe(200);
      // INTI REGRESI: created harus jumlah batch (sebelumnya selalu 0)
      expect(sync.siswa.created).toBe(TOTAL_SISWA);
      expect(sync.siswa.updated).toBe(0);
      expect(sync.sekolah.updated).toBe(1);
      expect(sync.gtk.created).toBe(2);
      expect(sync.gtk.archived).toBe(0);
      expect(sync.rombel.created).toBe(1);
      expect(sync._archive).not.toBeNull();

      // --- Rincian request modular: 4 modul + chunk 50/50/3 ---
      expect(cms.ingest.map((r) => r.dataType)).toEqual([
        "sekolah",
        "gtk",
        "rombel",
        "peserta_didik",
        "peserta_didik",
        "peserta_didik",
      ]);
      expect(
        cms.ingest.filter((r) => r.dataType === "peserta_didik").map((r) => r.payloadSize)
      ).toEqual([50, 50, 3]);
      expect(cms.archive).not.toBeNull();
      expect(cms.archive!.pesertaDidikIds.length).toBe(TOTAL_SISWA);
      expect(cms.archive!.gtkIds).toEqual(["1111111111", "2222222222"]);

      // --- Jalur dry-run (/api/preview): tanpa archive, angka sama ---
      const previewRes = await fetch(`${base}/api/preview`, { method: "POST" });
      const preview = (await previewRes.json()) as SyncSummary;
      expect(previewRes.status).toBe(200);
      expect(preview.siswa.created).toBe(TOTAL_SISWA);
      expect(preview._archive).toBeNull();
      // dry-run menambah request baru — hitung hanya yang commit sebelumnya
      expect(cms.ingest.filter((r) => r.mode !== "dry-run")).toHaveLength(6);
    } finally {
      await cleanup();
    }
  });

  it("dry-run tidak pernah memanggil archive", async () => {
    const { base, cms, cleanup } = await startBridge(3);
    try {
      const res = await fetch(`${base}/api/preview`, { method: "POST" });
      const json = (await res.json()) as SyncSummary;
      expect(res.status).toBe(200);
      expect(json.siswa.created).toBe(3);
      expect(json._archive).toBeNull();
      expect(cms.archive).toBeNull(); // archive TIDAK pernah dipanggil
    } finally {
      await cleanup();
    }
  });
});
