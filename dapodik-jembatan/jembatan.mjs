#!/usr/bin/env node
"use strict";

/**
 * Jembatan Dapodik — CMS MONSA
 * Jalan di PC sekolah: tarik HTTP localhost:5774, kirim ke CMS HTTPS.
 * Port 5774 tidak perlu dibuka ke internet.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.JEMBATAN_PORT || 3847);
const HOST = "127.0.0.1";
const CONFIG_PATH = path.join(__dirname, "jembatan-config.json");
const DAPODIK_TIMEOUT_MS = 30_000;
const CMS_TIMEOUT_MS = 120_000;
const MAX_PAGES = 200;
const MAX_ROWS_PER_ENDPOINT = 20_000;

const DEFAULTS = {
  cmsUrl: "https://sdn-mongisidi1.sch.id",
  bridgeToken: "",
  npsn: "",
  token: "",
  host: "localhost",
  port: 5774,
  protocol: "http",
};

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(cfg) {
  const next = { ...DEFAULTS, ...cfg };
  next.port = Number(next.port) || 5774;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt) {
  return attempt === 1 ? 400 : 1200;
}

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function elapsedSeconds(startedAt) {
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

function createRunLogger(label) {
  const startedAt = Date.now();
  return {
    step(message) {
      console.log(`[${label}] ${message}… (${elapsedSeconds(startedAt)}s)`);
    },
    info(message) {
      console.log(`[${label}] ${message} (${elapsedSeconds(startedAt)}s)`);
    },
    error(message) {
      console.error(`[${label}] ${message} (${elapsedSeconds(startedAt)}s)`);
    },
  };
}

function formatError(err) {
  if (err instanceof Error) return err.stack || err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function logFatal(kind, err) {
  console.error(`[FATAL] ${kind}`);
  console.error(formatError(err));
}

process.on("uncaughtException", (err) => {
  logFatal("uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logFatal("unhandledRejection", reason);
  process.exit(1);
});

async function requestRaw(baseUrl, npsn, token, endpoint, params = {}) {
  const query = new URLSearchParams({
    npsn,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const url = `${baseUrl}/${endpoint}?${query.toString()}`;
  const MAX_ATTEMPTS = 3;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DAPODIK_TIMEOUT_MS);
    let response;
    try {
      try {
        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) throw err;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
      if (response.status < 500 || attempt === MAX_ATTEMPTS) throw err;
      lastError = err;
      await sleep(backoffMs(attempt));
      continue;
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      const msg =
        "Respons dari Dapodik bukan JSON valid (token/NPSN salah, atau IP belum di-whitelist). Cuplikan: " +
        text.slice(0, 150);
      const fatal = /access denied|unauthorized|forbidden/i.test(text);
      if (fatal || attempt === MAX_ATTEMPTS) throw new Error(msg);
      lastError = new Error(msg);
      await sleep(backoffMs(attempt));
    }
  }
  throw lastError;
}

function sameRows(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function requestSingle(baseUrl, npsn, token, endpoint) {
  const json = await requestRaw(baseUrl, npsn, token, endpoint);
  if (json && typeof json === "object" && "rows" in json) {
    const rows = json.rows;
    return Array.isArray(rows) ? rows[0] : rows;
  }
  return json;
}

async function requestAllPages(baseUrl, npsn, token, endpoint, pageSize = 100) {
  const allRows = [];
  let start = 0;
  let lastPageKeys = null;
  let page = 0;
  while (true) {
    page += 1;
    if (page > MAX_PAGES) {
      throw new Error(
        `Pengaman paging aktif: endpoint ${endpoint} tidak selesai setelah ${MAX_PAGES} halaman (${allRows.length} baris). Web Service Dapodik kemungkinan mengabaikan start/limit.`
      );
    }

    const json = await requestRaw(baseUrl, npsn, token, endpoint, {
      start,
      limit: pageSize,
    });
    if (!json || typeof json !== "object" || !("rows" in json)) {
      return Array.isArray(json) ? json : [json];
    }

    const rows = Array.isArray(json.rows) ? json.rows : json.rows ? [json.rows] : [];
    if (rows.length === 0) break;

    const pageKeys = rows.map((r) => JSON.stringify(r));
    if (lastPageKeys && sameRows(lastPageKeys, pageKeys)) break;
    lastPageKeys = pageKeys;

    allRows.push(...rows);
    if (allRows.length > MAX_ROWS_PER_ENDPOINT) {
      throw new Error(
        `Pengaman paging aktif: endpoint ${endpoint} mengirim lebih dari ${MAX_ROWS_PER_ENDPOINT.toLocaleString("id-ID")} baris tanpa berhenti. Web Service Dapodik kemungkinan mengabaikan start/limit.`
      );
    }

    start += rows.length;
    const total = typeof json.results === "number" ? json.results : null;
    if (total !== null && allRows.length >= total) break;
  }
  return allRows;
}

function dapodikBase(cfg) {
  return `${cfg.protocol || "http"}://${cfg.host || "localhost"}:${Number(cfg.port) || 5774}/WebService`;
}

async function pullDapodik(cfg, onStep) {
  if (!cfg.npsn || !cfg.token) {
    throw new Error("NPSN dan token Web Service Dapodik wajib diisi.");
  }
  const base = dapodikBase(cfg);
  onStep && onStep("menarik sekolah");
  const sekolah = await requestSingle(base, cfg.npsn, cfg.token, "getSekolah");
  onStep && onStep("menarik siswa");
  const peserta_didik = await requestAllPages(base, cfg.npsn, cfg.token, "getPesertaDidik");
  onStep && onStep("menarik GTK");
  const gtk = await requestAllPages(base, cfg.npsn, cfg.token, "getGtk");
  onStep && onStep("menarik rombel");
  const rombel = await requestAllPages(base, cfg.npsn, cfg.token, "getRombonganBelajar");
  return { sekolah, peserta_didik, gtk, rombel };
}

async function postCms(cfg, payload, mode) {
  const cms = trimSlash(cfg.cmsUrl);
  if (!cms) throw new Error("URL CMS wajib diisi.");
  if (!cfg.bridgeToken) throw new Error("Kunci pairing CMS wajib diisi.");
  const url = `${cms}/api/dapodik/ingest${mode ? `?mode=${encodeURIComponent(mode)}` : ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CMS_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.bridgeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Koneksi ke CMS melewati batas ${Math.round(CMS_TIMEOUT_MS / 1000)} detik.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`CMS membalas bukan JSON (HTTP ${res.status}): ${text.slice(0, 180)}`);
  }
  if (!res.ok) {
    throw new Error(json.error || json.message || `HTTP ${res.status}`);
  }
  return json;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON tidak valid"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function openBrowser(url) {
  try {
    let child;
    if (process.platform === "win32") {
      child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
    } else if (process.platform === "darwin") {
      child = spawn("open", [url], { detached: true, stdio: "ignore" });
    } else {
      child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    }
    // Kegagalan membuka browser terjadi asynchronous, jadi try/catch saja tidak
    // cukup. Server harus tetap hidup agar alamat bisa dibuka manual.
    child.once("error", () => {});
    child.unref();
  } catch {
    /* abaikan — operator bisa buka manual */
  }
}

function page() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jembatan Dapodik — CMS MONSA</title>
  <style>
    :root { --bg:#f4f7f6; --card:#fff; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --teal:#0f766e; --teal-ink:#ecfdf5; --danger:#b91c1c; --ok:#047857; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--ink); }
    header { background: var(--teal); color: #fff; padding: 20px 24px; }
    header h1 { margin:0 0 4px; font-size: 20px; }
    header p { margin:0; opacity:.9; font-size: 13px; }
    main { max-width: 880px; margin: 20px auto; padding: 0 16px 40px; display:grid; gap:16px; }
    .card { background: var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 18px; }
    .card h2 { margin:0 0 12px; font-size:15px; }
    label { display:block; font-size:12px; color: var(--muted); margin: 8px 0 4px; }
    input { width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:8px; font-size:14px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .row { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    button { border:0; border-radius:8px; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; }
    button.primary { background: var(--teal); color:#fff; }
    button.ghost { background:#e2e8f0; color: var(--ink); }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .hint { font-size:12px; color: var(--muted); margin-top:10px; line-height:1.45; }
    #log { font-family: ui-monospace, Consolas, monospace; font-size:12px; white-space:pre-wrap; background:#0f172a; color:#e2e8f0; border-radius:8px; padding:12px; min-height:140px; max-height:320px; overflow:auto; }
    .ok { color: #6ee7b7; }
    .err { color: #fca5a5; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Jembatan Dapodik</h1>
    <p>Tarik data dari Dapodik di komputer ini, kirim ke website sekolah. Port 5774 tetap lokal.</p>
  </header>
  <main>
    <div class="card">
      <h2>Pengaturan</h2>
      <div class="grid">
        <div>
          <label for="cmsUrl">URL CMS (website sekolah)</label>
          <input id="cmsUrl" placeholder="https://sdn-mongisidi1.sch.id" />
        </div>
        <div>
          <label for="bridgeToken">Kunci pairing CMS</label>
          <input id="bridgeToken" type="password" placeholder="monsa_br_…" />
        </div>
        <div>
          <label for="npsn">NPSN</label>
          <input id="npsn" placeholder="40313912" />
        </div>
        <div>
          <label for="token">Token Web Service Dapodik</label>
          <input id="token" type="password" placeholder="token Dapodik" />
        </div>
        <div>
          <label for="host">Host Dapodik</label>
          <input id="host" placeholder="localhost" />
        </div>
        <div>
          <label for="port">Port Dapodik</label>
          <input id="port" placeholder="5774" />
        </div>
      </div>
      <p class="hint">Kunci pairing dibuat di dashboard CMS → Penarikan Dapodik → Jembatan PC Sekolah. Token Dapodik dari pengaturan Web Service aplikasi Dapodik.</p>
      <div class="row">
        <button class="ghost" id="btnSave" type="button">Simpan</button>
        <button class="ghost" id="btnDapo" type="button">Tes Dapodik</button>
        <button class="ghost" id="btnCms" type="button">Tes CMS</button>
        <button class="ghost" id="btnPreview" type="button">Pratinjau</button>
        <button class="primary" id="btnSync" type="button">Tarik &amp; Kirim</button>
      </div>
    </div>
    <div class="card">
      <h2>Log</h2>
      <div id="log">Siap. Isi pengaturan, lalu Tes Dapodik.</div>
    </div>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    const fields = ["cmsUrl","bridgeToken","npsn","token","host","port"];
    const logEl = $("log");
    function log(msg, cls) {
      const line = document.createElement("div");
      if (cls) line.className = cls;
      line.textContent = new Date().toLocaleTimeString("id-ID") + "  " + msg;
      if (logEl.textContent.startsWith("Siap.")) logEl.textContent = "";
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    }
    function readForm() {
      const o = {};
      for (const f of fields) o[f] = $(f).value.trim();
      o.port = Number(o.port) || 5774;
      o.protocol = "http";
      return o;
    }
    function fill(cfg) {
      for (const f of fields) if (cfg[f] != null) $(f).value = cfg[f];
    }
    async function api(path, method, body) {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || ("HTTP " + res.status));
      return json;
    }
    function busy(on) {
      for (const id of ["btnSave","btnDapo","btnCms","btnPreview","btnSync"]) $(id).disabled = on;
    }
    fetch("/api/config").then((r) => r.json()).then(fill).catch(() => {});
    $("btnSave").onclick = async () => {
      try { await api("/api/config", "PUT", readForm()); log("Pengaturan disimpan.", "ok"); }
      catch (e) { log(e.message, "err"); }
    };
    $("btnDapo").onclick = async () => {
      busy(true);
      try {
        await api("/api/config", "PUT", readForm());
        const r = await api("/api/test-dapodik", "POST");
        log(r.message || "Dapodik tersambung.", "ok");
      } catch (e) { log(e.message, "err"); }
      finally { busy(false); }
    };
    $("btnCms").onclick = async () => {
      busy(true);
      try {
        await api("/api/config", "PUT", readForm());
        const r = await api("/api/test-cms", "POST");
        log(r.message || "CMS menerima kunci pairing.", "ok");
      } catch (e) { log(e.message, "err"); }
      finally { busy(false); }
    };
    $("btnPreview").onclick = async () => {
      busy(true);
      try {
        await api("/api/config", "PUT", readForm());
        log("Menarik data Dapodik lalu pratinjau ke CMS…");
        const r = await api("/api/preview", "POST");
        const s = r.siswa || {}, g = r.gtk || {}, rb = r.rombel || {};
        log(
          "Pratinjau: siswa +" + (s.created||0) + "/" + (s.updated||0) + " arsip " + (s.archived||0) +
          " · guru +" + (g.created||0) + "/" + (g.updated||0) +
          " · rombel +" + (rb.created||0) + "/" + (rb.updated||0),
          "ok"
        );
      } catch (e) { log(e.message, "err"); }
      finally { busy(false); }
    };
    $("btnSync").onclick = async () => {
      if (!confirm("Tarik data dari Dapodik lokal dan kirim ke CMS sekarang?")) return;
      busy(true);
      try {
        await api("/api/config", "PUT", readForm());
        log("Menarik data Dapodik (berurutan)…");
        const r = await api("/api/sync", "POST");
        const s = r.siswa || {}, g = r.gtk || {}, rb = r.rombel || {};
        log(
          "Terkirim: siswa +" + (s.created||0) + "/" + (s.updated||0) +
          " · guru +" + (g.created||0) + "/" + (g.updated||0) +
          " · rombel +" + (rb.created||0) + "/" + (rb.updated||0),
          "ok"
        );
      } catch (e) { log(e.message, "err"); }
      finally { busy(false); }
    };
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, page());
    }
    if (req.method === "GET" && url.pathname === "/api/config") {
      const cfg = loadConfig();
      return send(res, 200, cfg);
    }
    if (req.method === "PUT" && url.pathname === "/api/config") {
      const body = await readBody(req);
      const cfg = saveConfig(body);
      return send(res, 200, { ok: true, cmsUrl: cfg.cmsUrl, npsn: cfg.npsn, host: cfg.host, port: cfg.port });
    }
    if (req.method === "POST" && url.pathname === "/api/test-dapodik") {
      const cfg = loadConfig();
      const sekolah = await requestSingle(dapodikBase(cfg), cfg.npsn, cfg.token, "getSekolah");
      return send(res, 200, {
        ok: true,
        message: `Tersambung ke Dapodik — ${sekolah?.nama || "sekolah"} (NPSN: ${sekolah?.npsn || cfg.npsn})`,
      });
    }
    if (req.method === "POST" && url.pathname === "/api/test-cms") {
      const cfg = loadConfig();
      const json = await postCms(cfg, { ping: true }, "dry-run");
      return send(res, 200, { ok: true, message: json.message || "Kunci pairing valid." });
    }
    if (req.method === "POST" && (url.pathname === "/api/preview" || url.pathname === "/api/sync")) {
      const cfg = loadConfig();
      const runLabel = url.pathname === "/api/preview" ? "preview" : "commit";
      const mode = runLabel === "preview" ? "dry-run" : "commit";
      const runLog = createRunLogger(runLabel);

      try {
        const payload = await pullDapodik(cfg, (message) => runLog.step(message));
        runLog.step(
          `mengirim ke CMS (${payload.peserta_didik.length} siswa, ${payload.gtk.length} GTK, ${payload.rombel.length} rombel)`
        );
        const json = await postCms(cfg, payload, mode);
        const siswa = json?.siswa || {};
        const gtk = json?.gtk || {};
        const rombel = json?.rombel || {};
        runLog.info(
          `selesai: siswa +${siswa.created || 0}/${siswa.updated || 0} · guru +${gtk.created || 0}/${gtk.updated || 0} · rombel +${rombel.created || 0}/${rombel.updated || 0}`
        );
        return send(res, 200, json);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        runLog.error(`gagal: ${message}`);
        throw err;
      }
    }
    send(res, 404, { error: "Tidak ditemukan." });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(res, 500, { error: message });
  }
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} sedang dipakai. Tutup Jembatan Dapodik yang lama, lalu jalankan lagi.`);
  } else {
    console.error("Jembatan Dapodik gagal dijalankan:", err?.message || err);
  }
  process.exitCode = 1;
});

server.requestTimeout = 0;
server.headersTimeout = 0;

server.listen(PORT, HOST, () => {
  const actualPort = server.address() && typeof server.address() === "object" ? server.address().port : PORT;
  const url = `http://${HOST}:${actualPort}`;
  console.log(`Jembatan Dapodik siap di ${url}`);
  console.log("Tekan Ctrl+C untuk berhenti. Jangan tutup jendela ini selama penarikan.");
  if (process.env.JEMBATAN_NO_BROWSER !== "1") openBrowser(url);
});
