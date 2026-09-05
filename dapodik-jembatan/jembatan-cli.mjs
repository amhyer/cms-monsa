#!/usr/bin/env node
/**
 * Jembatan Dapodik CLI - Versi Command Line
 * Untuk sinkronisasi otomatis tanpa browser
 * 
 * Usage:
 *   ./jembatan-cli.mjs sync              # Sinkronisasi data
 *   ./jembatan-cli.mjs test              # Test koneksi
 *   ./jembatan-cli.mjs preview           # Preview data tanpa commit
 *   ./jembatan-cli.mjs config            # Setup konfigurasi interaktif
 *   ./jembatan-cli.mjs --help            # Show help
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "jembatan-config.json");

// Konfigurasi default
const DEFAULTS = {
  cmsUrl: "",
  bridgeToken: "",
  npsn: "",
  token: "",
  host: "localhost",
  port: 5774,
  protocol: "http",
};

// Helper functions
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

async function requestRaw(baseUrl, npsn, token, endpoint, params = {}) {
  const query = new URLSearchParams({
    npsn,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const url = `${baseUrl}/${endpoint}?${query.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
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
  while (true) {
    const json = await requestRaw(baseUrl, npsn, token, endpoint, {
      start,
      limit: pageSize,
    });
    if (!json || typeof json !== "object" || !("rows" in json)) {
      return Array.isArray(json) ? json : [json];
    }
    const rows = Array.isArray(json.rows) ? json.rows : json.rows ? [json.rows] : [];
    if (rows.length === 0) break;
    allRows.push(...rows);
    start += rows.length;
    const total = typeof json.results === "number" ? json.results : null;
    if (total !== null && allRows.length >= total) break;
  }
  return allRows;
}

function dapodikBase(cfg) {
  return `${cfg.protocol || "http"}://${cfg.host || "localhost"}:${Number(cfg.port) || 5774}/WebService`;
}

async function pullDapodik(cfg) {
  if (!cfg.npsn || !cfg.token) {
    throw new Error("NPSN dan token Web Service Dapodik wajib diisi.");
  }
  const base = dapodikBase(cfg);
  
  console.log("📡 Menghubungi Dapodik...");
  const sekolah = await requestSingle(base, cfg.npsn, cfg.token, "getSekolah");
  console.log(`   ✓ Sekolah: ${sekolah?.nama || "-"}`);
  
  console.log("📡 Menarik data peserta didik...");
  const peserta_didik = await requestAllPages(base, cfg.npsn, cfg.token, "getPesertaDidik");
  console.log(`   ✓ ${peserta_didik.length} siswa`);
  
  console.log("📡 Menarik data GTK...");
  const gtk = await requestAllPages(base, cfg.npsn, cfg.token, "getGtk");
  console.log(`   ✓ ${gtk.length} guru/staf`);
  
  console.log("📡 Menarik data rombel...");
  const rombel = await requestAllPages(base, cfg.npsn, cfg.token, "getRombonganBelajar");
  console.log(`   ✓ ${rombel.length} rombel`);
  
  return { sekolah, peserta_didik, gtk, rombel };
}

async function postCms(cfg, payload, mode) {
  const cms = String(cfg.cmsUrl || "").replace(/\/+$/, "");
  if (!cms) throw new Error("URL CMS wajib diisi.");
  if (!cfg.bridgeToken) throw new Error("Kunci pairing CMS wajib diisi.");
  
  const url = `${cms}/api/dapodik/ingest${mode ? `?mode=${encodeURIComponent(mode)}` : ""}`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.bridgeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

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

// Commands
async function cmdSync(cfg) {
  console.log("\n🚀 Memulai Sinkronisasi...\n");
  
  const data = await pullDapodik(cfg);
  
  console.log("\n📤 Mengirim ke CMS...");
  const result = await postCms(cfg, data, "commit");
  
  console.log("\n✅ Sinkronisasi Selesai!\n");
  console.log("📊 Ringkasan:");
  console.log(`   Sekolah: ${result.sekolah?.updated || 0} update`);
  console.log(`   Siswa: ${result.siswa?.created || 0} baru, ${result.siswa?.updated || 0} update`);
  console.log(`   GTK: ${result.gtk?.created || 0} baru, ${result.gtk?.updated || 0} update`);
  console.log(`   Rombel: ${result.rombel?.created || 0} baru, ${result.rombel?.updated || 0} update`);
  
  return result;
}

async function cmdPreview(cfg) {
  console.log("\n👁️ Preview Data (dry-run)...\n");
  
  const data = await pullDapodik(cfg);
  
  console.log("\n📤 Preview di CMS...");
  const result = await postCms(cfg, data, "dry-run");
  
  console.log("\n📊 Preview Result:");
  console.log(`   Siswa: +${result.siswa?.created || 0} / ~${result.siswa?.updated || 0}`);
  console.log(`   GTK: +${result.gtk?.created || 0} / ~${result.gtk?.updated || 0}`);
  console.log(`   Rombel: +${result.rombel?.created || 0} / ~${result.rombel?.updated || 0}`);
  
  return result;
}

async function cmdTest(cfg) {
  console.log("\n🔍 Test Koneksi...\n");
  
  // Test Dapodik
  console.log("📡 Test koneksi Dapodik...");
  try {
    const base = dapodikBase(cfg);
    const sekolah = await requestSingle(base, cfg.npsn, cfg.token, "getSekolah");
    console.log(`   ✅ Dapodik OK: ${sekolah?.nama || "-"} (NPSN: ${sekolah?.npsn || cfg.npsn})`);
  } catch (err) {
    console.log(`   ❌ Dapodik GAGAL: ${err.message}`);
    throw err;
  }
  
  // Test CMS
  console.log("📡 Test koneksi CMS...");
  try {
    const cms = String(cfg.cmsUrl || "").replace(/\/+$/, "");
    const url = `${cms}/api/dapodik/ingest?mode=dry-run`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.bridgeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ping: true }),
    });
    console.log(`   ✅ CMS OK: HTTP ${res.status}`);
  } catch (err) {
    console.log(`   ❌ CMS GAGAL: ${err.message}`);
    throw err;
  }
  
  console.log("\n✅ Semua koneksi berhasil!\n");
}

function cmdHelp() {
  console.log(`
Jembatan Dapodik CLI
====================

Usage: jembatan-cli.mjs [command] [options]

Commands:
  sync      Sinkronisasi data dari Dapodik ke CMS (commit)
  preview   Preview data tanpa commit ke CMS
  test      Test koneksi Dapodik dan CMS
  config    Setup konfigurasi interaktif
  --help    Tampilkan bantuan ini

Examples:
  ./jembatan-cli.mjs test
  ./jembatan-cli.mjs preview
  ./jembatan-cli.mjs sync

Konfigurasi:
  File konfigurasi tersimpan di: ${CONFIG_PATH}
  
  Alternatif, bisa set environment variables:
  - JEMBATAN_CMS_URL
  - JEMBATAN_BRIDGE_TOKEN
  - JEMBATAN_NPSN
  - JEMBATAN_TOKEN
  - JEMBATAN_HOST (default: localhost)
  - JEMBATAN_PORT (default: 5774)
`);
}

// Interactive config setup
function cmdConfig() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q) =>
    new Promise((resolve) => rl.question(q, resolve));

  (async () => {
    console.log("\n⚙️  Setup Konfigurasi Jembatan Dapodik\n");
    console.log("(Tekan Enter untuk menyimpan nilai default)\n");

    const current = loadConfig();

    const cmsUrl = await question(`URL CMS [${current.cmsUrl || "https://..."}]: `) || current.cmsUrl;
    const bridgeToken = await question(`Kunci Pairing CMS [${current.bridgeToken ? "****" : "-"}]: `) || current.bridgeToken;
    const npsn = await question(`NPSN [${current.npsn || "-"}]: `) || current.npsn;
    const token = await question(`Token Dapodik [${current.token ? "****" : "-"}]: `) || current.token;
    const host = await question(`Host Dapodik [${current.host}]: `) || current.host;
    const port = await question(`Port Dapodik [${current.port}]: `) || current.port;

    const cfg = saveConfig({
      cmsUrl,
      bridgeToken,
      npsn,
      token,
      host,
      port: Number(port) || 5774,
    });

    console.log("\n✅ Konfigurasi disimpan!\n");
    console.log("💡 Jalankan './jembatan-cli.mjs test' untuk test koneksi");
    console.log("💡 Jalankan './jembatan-cli.mjs sync' untuk sinkronisasi\n");

    rl.close();
  })();
}

// Main
const command = process.argv[2];

const config = {
  ...loadConfig(),
  // Environment variable override
  cmsUrl: process.env.JEMBATAN_CMS_URL || loadConfig().cmsUrl,
  bridgeToken: process.env.JEMBATAN_BRIDGE_TOKEN || loadConfig().bridgeToken,
  npsn: process.env.JEMBATAN_NPSN || loadConfig().npsn,
  token: process.env.JEMBATAN_TOKEN || loadConfig().token,
  host: process.env.JEMBATAN_HOST || loadConfig().host,
  port: Number(process.env.JEMBATAN_PORT || loadConfig().port) || 5774,
};

(async () => {
  try {
    switch (command) {
      case "sync":
        await cmdSync(config);
        break;
      case "preview":
        await cmdPreview(config);
        break;
      case "test":
        await cmdTest(config);
        break;
      case "config":
        cmdConfig();
        break;
      case "--help":
      case "-h":
      case undefined:
        cmdHelp();
        break;
      default:
        console.error(`❌ Perintah tidak dikenal: ${command}`);
        console.error("   Jalankan './jembatan-cli.mjs --help' untuk bantuan");
        process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  }
})();
