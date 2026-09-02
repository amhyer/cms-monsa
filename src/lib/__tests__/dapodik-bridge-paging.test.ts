import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getJembatanFiles } from "@/lib/dapodik-jembatan-files";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function reservePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return port;
}

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
) {
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });

  const port = await reservePort();
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

  return {
    port,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    },
  };
}

async function startBridge(config: {
  cmsUrl: string;
  bridgeToken: string;
  npsn: string;
  token: string;
  host: string;
  port: number;
}) {
  const dir = await mkdtemp(join(tmpdir(), "cms-monsa-jembatan-"));
  const files = getJembatanFiles();

  for (const file of files) {
    await writeFile(join(dir, file.name), file.content, "utf8");
  }

  const bridgePort = await reservePort();
  await writeFile(
    join(dir, "jembatan-config.json"),
    JSON.stringify({ ...config, protocol: "http" }, null, 2),
    "utf8"
  );

  const entry = join(dir, "jembatan.mjs");
  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      JEMBATAN_PORT: String(bridgePort),
      JEMBATAN_NO_BROWSER: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const collect = (chunk: Buffer | string) => {
    output += chunk.toString();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Jembatan tidak siap dalam 5 detik. Output: ${output}`));
    }, 5_000);

    const ready = () => {
      if (!output.includes("Jembatan Dapodik siap di")) return;
      clearTimeout(timer);
      child.stdout.off("data", readyFromStdout);
      child.stderr.off("data", readyFromStderr);
      resolve();
    };
    const readyFromStdout = () => ready();
    const readyFromStderr = () => ready();

    child.stdout.on("data", readyFromStdout);
    child.stderr.on("data", readyFromStderr);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Jembatan berhenti sebelum siap (kode ${code}). Output: ${output}`));
    });
  });

  return {
    bridgePort,
    getOutput: () => output,
    async readConfig() {
      return await readFile(join(dir, "jembatan-config.json"), "utf8");
    },
    async stop() {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([
          once(child, "exit"),
          new Promise((resolve) => setTimeout(resolve, 2_000)),
        ]);
      }
      await rm(dir, { recursive: true, force: true });
    },
    get exitCode() {
      return child.exitCode;
    },
  };
}

describe("jembatan paging guard", () => {
  it("menggabungkan semua halaman WS normal dan meneruskan payload ke pratinjau CMS", async () => {
    const pesertaDidik = Array.from({ length: 230 }, (_, index) => ({
      peserta_didik_id: `pd-${index + 1}`,
      nama: `Siswa ${index + 1}`,
    }));
    const gtk = Array.from({ length: 17 }, (_, index) => ({
      ptk_id: `gtk-${index + 1}`,
      nama: `Guru ${index + 1}`,
    }));
    const rombel = Array.from({ length: 6 }, (_, index) => ({
      rombongan_belajar_id: `rombel-${index + 1}`,
      nama: `Kelas ${index + 1}`,
    }));

    const starts: Record<string, number[]> = {
      getPesertaDidik: [],
      getGtk: [],
      getRombonganBelajar: [],
    };
    const cmsRequests: Array<{
      mode: string | null;
      body: {
        peserta_didik?: unknown[];
        gtk?: unknown[];
        rombel?: unknown[];
      };
    }> = [];

    const ws = await startServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const endpoint = url.pathname.split("/").pop() || "";
      const start = Number(url.searchParams.get("start") || 0);
      const limit = Number(url.searchParams.get("limit") || 100);

      if (endpoint === "getSekolah") {
        return sendJson(res, 200, {
          rows: [{ nama: "SD Test", npsn: "12345678" }],
        });
      }

      const table =
        endpoint === "getPesertaDidik"
          ? pesertaDidik
          : endpoint === "getGtk"
            ? gtk
            : rombel;

      if (endpoint in starts) starts[endpoint].push(start);
      return sendJson(res, 200, {
        rows: table.slice(start, start + limit),
        results: table.length,
      });
    });

    const cms = await startServer(async (req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      cmsRequests.push({ mode: url.searchParams.get("mode"), body: await readJsonBody(req) });
      return sendJson(res, 200, {
        ok: true,
        siswa: { created: pesertaDidik.length, updated: 0, archived: 0 },
        gtk: { created: gtk.length, updated: 0 },
        rombel: { created: rombel.length, updated: 0 },
      });
    });

    const bridge = await startBridge({
      cmsUrl: `http://127.0.0.1:${cms.port}`,
      bridgeToken: "monsa_br_test",
      npsn: "12345678",
      token: "dapodik-token",
      host: "127.0.0.1",
      port: ws.port,
    });

    try {
      const response = await fetch(`http://127.0.0.1:${bridge.bridgePort}/api/preview`, {
        method: "POST",
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.siswa.created).toBe(230);
      expect(json.gtk.created).toBe(17);
      expect(json.rombel.created).toBe(6);
      expect(starts.getPesertaDidik).toEqual([0, 100, 200]);
      expect(starts.getGtk).toEqual([0]);
      expect(starts.getRombonganBelajar).toEqual([0]);
      expect(cmsRequests).toHaveLength(1);
      expect(cmsRequests[0]?.mode).toBe("dry-run");
      expect(cmsRequests[0]?.body.peserta_didik).toHaveLength(230);
      expect(cmsRequests[0]?.body.gtk).toHaveLength(17);
      expect(cmsRequests[0]?.body.rombel).toHaveLength(6);
      expect(await bridge.readConfig()).toContain('"protocol": "http"');
      expect(bridge.getOutput()).toContain("[preview] menarik siswa");
      expect(bridge.getOutput()).toContain("[preview] mengirim ke CMS");
      expect(bridge.getOutput()).toContain("[preview] selesai:");
    } finally {
      await bridge.stop();
      await cms.close();
      await ws.close();
    }
  });

  it("menghentikan paging rusak dengan error operator tanpa mematikan server lokal", async () => {
    let batch = 0;

    const ws = await startServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const endpoint = url.pathname.split("/").pop() || "";

      if (endpoint === "getSekolah") {
        return sendJson(res, 200, {
          rows: [{ nama: "SD Rusak", npsn: "12345678" }],
        });
      }

      if (endpoint === "getPesertaDidik") {
        const rows = Array.from({ length: 500 }, (_, index) => ({
          peserta_didik_id: `loop-${batch * 500 + index + 1}`,
          nama: `Loop ${batch * 500 + index + 1}`,
        }));
        batch += 1;
        return sendJson(res, 200, { rows });
      }

      return sendJson(res, 200, { rows: [] });
    });

    const cms = await startServer((_req, res) => {
      return sendJson(res, 200, { ok: true });
    });

    const bridge = await startBridge({
      cmsUrl: `http://127.0.0.1:${cms.port}`,
      bridgeToken: "monsa_br_test",
      npsn: "12345678",
      token: "dapodik-token",
      host: "127.0.0.1",
      port: ws.port,
    });

    try {
      const response = await fetch(`http://127.0.0.1:${bridge.bridgePort}/api/preview`, {
        method: "POST",
      });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toContain("Pengaman paging aktif");
      expect(json.error).toContain("start/limit");
      expect(batch).toBeGreaterThan(1);
      expect(bridge.exitCode).toBeNull();

      const stillAlive = await fetch(`http://127.0.0.1:${bridge.bridgePort}/api/config`);
      expect(stillAlive.status).toBe(200);
      expect(bridge.getOutput()).toContain("[preview] menarik siswa");
      expect(bridge.getOutput()).toContain("[preview] gagal:");
      expect(bridge.getOutput()).not.toContain("[FATAL]");
    } finally {
      await bridge.stop();
      await cms.close();
      await ws.close();
    }
  });

  it("bundle unduhan jembatan sudah memuat guard, logging fatal, dan launcher memori", () => {
    const files = getJembatanFiles();
    const mjs = files.find((file) => file.name === "jembatan.mjs")?.content ?? "";
    const bat = files.find((file) => file.name === "jalankan.bat")?.content ?? "";
    const vbs = files.find((file) => file.name === "MULAI-JEMBATAN.vbs")?.content ?? "";

    expect(mjs).toContain('process.on("uncaughtException"');
    expect(mjs).toContain('process.on("unhandledRejection"');
    expect(mjs).toContain("const MAX_PAGES = 200");
    expect(mjs).toContain("const MAX_ROWS_PER_ENDPOINT = 20_000");
    expect(mjs).toContain("server.requestTimeout = 0");
    expect(mjs).toContain("server.headersTimeout = 0");
    expect(mjs).toContain("Koneksi ke CMS melewati batas ${Math.round(CMS_TIMEOUT_MS / 1000)} detik.");
    expect(bat).toContain("NODE_OPTIONS=--max-old-space-size=2048");
    expect(vbs).toContain("NODE_OPTIONS=--max-old-space-size=2048");
  });
});
