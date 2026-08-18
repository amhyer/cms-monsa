/**
 * Pemanasan rute aplikasi sebelum suite E2E.
 *
 * Turbopack mengompilasi rute saat pertama kali diminta; tanpa pemanasan, hit
 * pertama sebuah test bisa melebihi timeout (flaky "first attempt" — lihat
 * academic-check & csrf-header). Modul ini dipakai oleh tiga jalur:
 *   1. e2e/global-setup.ts  — Playwright memanaskan setelah webServer siap.
 *   2. scripts/run-e2e.ts    — workflow `test:e2e` memanaskan sebelum suite.
 *   3. CLI (`bun run e2e:warmup`) — panaskan server yang sedang berjalan.
 *
 * baseURL tidak di-hardcode agar ikut override port (env E2E_BASE_URL).
 */

import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const WARMUP_ROUTES = [
  "/",
  "/login",
  "/profile",
  "/news",
  "/gallery",
  "/contact",
  "/complaint",
  "/academic",
  "/struktur-organisasi",
  "/transparansi",
  "/dashboard",
] as const;

/** Direktori spec E2E (default). Bisa di-override lewat env E2E_TEST_DIR. */
export const DEFAULT_E2E_TEST_DIR = "./e2e";

/** Direktori rute API aplikasi (di-scan untuk pre-compile semua handler). */
export const DEFAULT_API_DIR = "./src/app/api";

/**
 * Resolve base URL untuk CLI warm-up (bukan untuk wrapper yang men-spawn
 * server sendiri). Urutan prioritas:
 *   1. E2E_BASE_URL — override eksplisit, menang selalu.
 *   2. .zscripts/dev.pid + .zscripts/dev.port — ditulis .zscripts/dev.sh saat
 *      dev server dinyalakan; port custom developer dipakai otomatis tanpa
 *      hardcode :3000.
 *   3. Fallback http://localhost:3000.
 *
 * PID di pidfile TIDAK dicek liveness-nya di sini: di Git Bash/Windows pidfile
 * berisi PID MSYS yang tidak bisa di-resolve Node terhadap PID Windows, jadi
 * cek process.kill(pid, 0) akan selalu gagal di sana. Kewenangan liveness
 * sebenarnya ada di probe (--if-up / waitForServer) — pidfile hanya
 * memberitahu port mana yang harus di-probe; server mati = probe gagal =
 * dilewati, persis seperti bila tidak ada pidfile.
 *
 * `source` dilaporkan agar CLI bisa log dari mana URL berasal.
 */
export function resolveDevBaseURL(): {
  url: string;
  source: "env" | "pidfile" | "default";
} {
  const explicit = process.env.E2E_BASE_URL;
  if (explicit) return { url: explicit, source: "env" };

  try {
    const pid = Number(readFileSync(join(process.cwd(), ".zscripts", "dev.pid"), "utf8").trim());
    const port = Number(readFileSync(join(process.cwd(), ".zscripts", "dev.port"), "utf8").trim());
    if (Number.isInteger(pid) && pid > 0 && Number.isInteger(port) && port > 0 && port < 65536) {
      return { url: `http://localhost:${port}`, source: "pidfile" };
    }
  } catch {
    // pidfile/port file tidak ada atau tidak valid — fallback di bawah.
  }
  return { url: "http://localhost:3000", source: "default" };
}

// Subtree yang TIDAK ikut di-warm otomatis: rute dapodik (auto-sync, sync,
// test-connection) bisa memanggil server Dapodik eksternal saat di-GET —
// pemanasan otomatis harus read-only dan cepat.
const API_EXCLUDED_SUBTREES = ["dapodik"];

// Pragmas deklarasi rute tambahan per spec file:
//   // warmup: /api/news /api/bos-expenditures   (path-only — semua method)
//   // warmup: POST /api/news DELETE /api/news   (method-spesifik)
// Dibaca secara statis oleh globalSetup / workflow test:e2e / CLI. Playwright
// menjalankan globalSetup di proses terpisah dari spec, jadi deklarasi tidak
// bisa diregistrasi saat runtime — harus bisa dipindai dari isi file.
//
// CATATAN: pemanasan tetap read-only (GET/HEAD/OPTIONS) — App Router
// mengompilasi semua handler (GET/POST/PUT/DELETE) dalam satu modul per rute,
// jadi GET warm sudah meng-compile handler non-GET. Bagian method dipakai
// check:warmup-declarations untuk memverifikasi method mutasi benar-benar
// dideklarasikan (path-only = method-agnostik, tetap kompatibel).
const WARMUP_PRAGMA = /^\s*\/\/\s*warmup:\s*(.+?)\s*$/gm;

/** Deklarasi warm-up: path (wajib) + method opsional (mis. `POST /api/news`). */
export interface WarmupDecl {
  method: string | null;
  path: string;
}

// Method keyword utuh (huruf besar tanpa slash) — pasangannya adalah path berikut.
const METHOD_TOKEN = /^[A-Z]+$/;

/**
 * Parse isi pragma menjadi deklarasi. Token berjalan berurutan: keyword
 * method (POST, DELETE, …) mengikat path berikutnya; token lain adalah
 * path-only (method null → semua method). Contoh:
 *   "POST /api/news /api/gallery" → [{POST, /api/news}, {null, /api/gallery}]
 */
export function parseWarmupDecl(content: string): WarmupDecl[] {
  const tokens = content.split(/[\s,]+/).filter(Boolean);
  const out: WarmupDecl[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (METHOD_TOKEN.test(t) && i + 1 < tokens.length) {
      out.push({ method: t.toUpperCase(), path: tokens[i + 1] });
      i += 2;
    } else {
      out.push({ method: null, path: t });
      i += 1;
    }
  }
  return out;
}

export interface WarmupOptions {
  /** Pencatat log; default console.log. */
  log?: (message: string) => void;
  /** Jumlah percobaan polling server. Default 24. */
  attempts?: number;
  /** Jeda antar percobaan (ms). Default 5_000. */
  intervalMs?: number;
  /** Timeout tiap request (ms). Default 60_000. */
  requestTimeoutMs?: number;
  /** Daftar rute yang dipanaskan; default WARMUP_ROUTES. */
  routes?: readonly string[];
  /** Rute sintetis (segmen dinamis [id]); ditandai ◇ di log. */
  synthetic?: ReadonlySet<string>;
}

const DEFAULT_ATTEMPTS = 24;
const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

/** Polling sampai server merespons; false bila percobaan habis. */
export async function waitForServer(
  baseURL: string,
  options: WarmupOptions = {}
): Promise<boolean> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseURL}/`, {
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      void res; // status apa pun = server sudah merespons.
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

/**
 * Panaskan tiap rute berurutan (kompilasi paralel bisa thrash di mesin
 * lambat). Mengembalikan JUMLAH rute yang gagal dipanaskan (0 = semua ok) —
 * pemanggil bisa memakai angka ini untuk diagnosa (mis. CLI men-tail log
 * server). Rute yang gagal TIDAK menggagalkan run — test tetap menjalankan
 * kompilasinya sendiri (timeout 90s memberi ruang); return hanya info.
 */
export async function warmRoutes(
  baseURL: string,
  options: WarmupOptions = {}
): Promise<number> {
  const log = options.log ?? ((m: string) => console.log(m));
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const routes = options.routes ?? WARMUP_ROUTES;
  const synthetic = options.synthetic ?? new Set<string>();

  let failed = 0;
  for (const route of routes) {
    try {
      const res = await fetch(`${baseURL}${route}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      // ◇ = rute sintetis untuk segmen dinamis ([id]) — status 404 wajar
      // (id tiruan) selama handler-nya ikut ter-compile.
      log(`${synthetic.has(route) ? "◇" : "✓"} ${route} -> ${res.status}`);
    } catch (err) {
      failed += 1;
      // Rute yang gagal tidak menggagalkan run — test tetap menjalankan
      // kompilasinya sendiri (timeout 90s memberi ruang).
      log(`✗ ${route} -> ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failed;
}

/**
 * Baca ekor log server DEVELOPER (reuse fallback, bukan log spawn):
 *   1. E2E_SERVER_LOG — bila menunjuk file yang ada.
 *   2. .zscripts/dev.log — log yang ditulis .zscripts/dev.sh (stdout+stderr).
 * Jumlah baris ikut E2E_TAIL_LINES (default 30, diklem 1..1000). null bila
 * keduanya tidak ada / kosong — sama dengan fallback tail reuse di
 * scripts/run-e2e.ts, dipakai CLI warm-up untuk diagnosa rute yang gagal.
 */
export async function tailDeveloperServerLog(
  lines = 30
): Promise<{ text: string; source: "E2E_SERVER_LOG" | "dev.log" } | null> {
  const clamped = Math.min(
    1000,
    Math.max(1, Number(process.env.E2E_TAIL_LINES) || lines)
  );
  const candidates: Array<[string, "E2E_SERVER_LOG" | "dev.log"]> = [];
  const envLog = process.env.E2E_SERVER_LOG;
  if (envLog) candidates.push([envLog, "E2E_SERVER_LOG"]);
  candidates.push([join(process.cwd(), ".zscripts", "dev.log"), "dev.log"]);
  for (const [p, source] of candidates) {
    try {
      const text = readFileSync(p, "utf8");
      const tail = text.split("\n").slice(-clamped).join("\n").trim();
      if (tail) return { text: tail, source };
    } catch {
      // file tidak ada / tidak terbaca — lanjut kandidat berikutnya.
    }
  }
  return null;
}

/** Kumpulkan rute yang dideklarasikan spec lewat pragma `// warmup: ...`. */
export async function collectSpecWarmupRoutes(
  testDir: string
): Promise<string[]> {
  const byFile = await collectSpecWarmupDeclsByFile(testDir);
  const declared: string[] = [];
  for (const decls of byFile.values()) {
    for (const d of decls) declared.push(d.path);
  }
  return declared;
}

/**
 * Pragma `// warmup:` per spec file, method-aware. Dipakai
 * check:warmup-declarations untuk mencocokkan mutasi API per spec.
 */
export async function collectSpecWarmupDeclsByFile(
  testDir: string
): Promise<Map<string, WarmupDecl[]>> {
  const out = new Map<string, WarmupDecl[]>();
  try {
    const entries = await readdir(testDir, { withFileTypes: true });
    const files = entries
      .filter((d) => d.isFile() && d.name.endsWith(".spec.ts"))
      .map((d) => d.name);
    for (const file of files) {
      const src = await readFile(join(testDir, file), "utf8");
      const decls: WarmupDecl[] = [];
      for (const m of src.matchAll(WARMUP_PRAGMA)) {
        decls.push(...parseWarmupDecl(m[1]));
      }
      if (decls.length) out.set(file, decls);
    }
    return out;
  } catch {
    return out; // direktori tidak ada — abaikan.
  }
}

/** Daftar rute (tanpa method) per spec file — dipakai ringkasan warm-up. */
export async function collectSpecWarmupRoutesByFile(
  testDir: string
): Promise<Map<string, string[]>> {
  const byFile = await collectSpecWarmupDeclsByFile(testDir);
  const out = new Map<string, string[]>();
  for (const [file, decls] of byFile) {
    out.set(file, decls.map((d) => d.path));
  }
  return out;
}

/**
 * Temukan SEMUA route handler API di src/app/api dan kembalikan path yang
 * siap di-fetch. Segmen dinamis ([id]) diganti `__warmup__` — GET ke id
 * tiruan meng-compile modul handler (GET/POST/PUT/DELETE ada di file yang
 * sama) lalu balas 404/405, jadi first-hit DELETE/PUT tidak pernah nge-stall.
 *
 * Dengan ini spec tidak perlu mendeklarasikan rute API — semua handler
 * ter-compile lebih dulu tanpa terkecuali (yang tidak diinginkan cukup
 * dimasukkan ke API_EXCLUDED_SUBTREES).
 */
export async function collectApiRoutes(
  apiDir: string = DEFAULT_API_DIR
): Promise<string[]> {
  try {
    const entries = await readdir(apiDir, { recursive: true });
    const routes: string[] = [];
    for (const rel of entries) {
      const norm = rel.replace(/\\/g, "/");
      if (!norm.endsWith("/route.ts")) continue;
      const first = norm.split("/")[0];
      if (API_EXCLUDED_SUBTREES.includes(first)) continue;
      const path = norm
        .replace(/\/route\.ts$/, "")
        .replace(/\[([^\]]+)\]/g, "__warmup__");
      routes.push(`/api/${path}`);
    }
    return routes.sort();
  } catch {
    return []; // direktori tidak ada — abaikan.
  }
}

/** Daftar rute akhir: default + deklarasi spec (dedupe, urut stabil). */
export function mergeWarmupRoutes(declared: readonly string[]): string[] {
  const seen = new Set<string>(WARMUP_ROUTES);
  const out = [...WARMUP_ROUTES];
  for (const r of declared) {
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

/**
 * Jaring pengaman: untuk rute API yang tidak ter-cakup discovery (mis.
 * apiDir khusus), tambahkan saudara sintetis `/__warmup__` agar segmen
 * dinamis ikut ter-compile. Dedupe penuh; rute yang SUDAH mengandung
 * `__warmup__` (hasil discovery) tidak digandakan lagi.
 */
export function expandWarmupRoutes(routes: readonly string[]): {
  routes: string[];
  synthetic: Set<string>;
} {
  const synthetic = new Set<string>();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of routes) {
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
    if (r.startsWith("/api/") && !r.includes("__warmup__")) {
      const s = `${r}/__warmup__`;
      if (!synthetic.has(s) && !seen.has(s)) {
        synthetic.add(s);
        seen.add(s);
        out.push(s);
      }
    }
  }
  return { routes: out, synthetic };
}

/**
 * Bangun daftar warm-up akhir: default + pragma spec + SEMUA rute API
 * (discovery otomatis) + segmen dinamis. Dipakai globalSetup, workflow
 * test:e2e, dan CLI agar ketiganya identik (satu sumber kebenaran).
 */
export async function buildWarmupRoutes(options: {
  testDir: string;
  apiDir?: string;
}): Promise<{
  routes: string[];
  synthetic: Set<string>;
  declared: string[];
  apiRoutes: string[];
}> {
  const declared = await collectSpecWarmupRoutes(options.testDir);
  const apiRoutes = await collectApiRoutes(options.apiDir ?? DEFAULT_API_DIR);
  const merged = mergeWarmupRoutes([...declared, ...apiRoutes]);
  const { routes, synthetic } = expandWarmupRoutes(merged);
  // Discovery sudah menghasilkan path `__warmup__` untuk [id] — tandai juga
  // sebagai segmen dinamis agar log memakai ◇.
  for (const r of apiRoutes) {
    if (r.includes("__warmup__")) synthetic.add(r);
  }
  return { routes, synthetic, declared, apiRoutes };
}
