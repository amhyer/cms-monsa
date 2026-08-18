/**
 * Workflow E2E: pastikan server naik → panaskan rute → jalankan suite → bersihkan.
 *
 * Dipanggil oleh `bun run test:e2e` (lokal maupun CI). Alur:
 *   1. Bila belum ada server di E2E_PORT, mulai E2E_SERVER_CMD (default `bun run dev`).
 *   2. Tunggu server merespons, lalu panaskan rute utama (e2e/warmup.ts).
 *   3. Jalankan `playwright test` dengan reuseExistingServer aktif (env
 *      PW_REUSE_SERVER=1) agar Playwright tidak memulai server duplikat.
 *   4. Matikan server yang tadi kita mulai; server milik proses lain dibiarkan.
 *
 * Bila suite GAGAL (exit ≠ 0), 30 baris terakhir log server (stdout + stderr)
 * dicetak ke output wrapper, lalu triage kegagalan (scripts/triage-e2e.ts)
 * dijalankan OTOMATIS dan verdict-nya (warmup-failed / stall cold-compile /
 * DNS / timeout) dicetak — konsol workflow CI seringkali sudah cukup untuk
 * diagnosa tanpa
 * mengunduh artifact server-e2e.log. Bila SUKSES (exit 0), ringkasan artifact
 * (statistik warm-up ✓/◇/✗ + jumlah request per method) ditulis ke step
 * summary GitHub — run hijau pun meninggalkan ringkasan yang bisa
 * dibandingkan antar run.
 *
 * Server target (urutan prioritas):
 *   - E2E_BASE_URL   — override eksplisit, menang selalu.
 *   - .zscripts/dev.pid/.port — port dev server developer (ditulis
 *     .zscripts/dev.sh) dipakai otomatis; bila ternyata basi (tidak
 *     merespons probe), wrapper jatuh ke server baru di E2E_PORT.
 *     Log server developer (.zscripts/dev.log) juga auto-dipakai sebagai
 *     sumber tail kegagalan di reuse mode (tanpa E2E_SERVER_LOG).
 *   - http://localhost:E2E_PORT (default 3000).
 *
 * Env:
 *   E2E_PORT         Port target (default 3000).
 *   E2E_SERVER_CMD   Perintah memulai server (default `bun run dev`).
 *                    Saat E2E_PORT ≠ 3000 sesuaikan perintahnya, mis.
 *                    `bunx next dev -p 3200`.
 *   E2E_BASE_URL     (opsional) override URL penuh, mis. http://localhost:3200.
 *   E2E_TAIL_LINES      (opsional) panjang tail log server stdout (baris)
 *                       saat suite gagal; default 100, diklem 1..1000.
 *   E2E_TAIL_LINES_ERR  (opsional) panjang tail log server stderr (baris);
 *                       default 15, diklem 1..1000.
 *   GITHUB_STEP_SUMMARY (GitHub Actions) — ekor log server juga di-append
 *   ke file ini agar render inline di UI workflow saat suite gagal.
 *
 * Argumen CLI diteruskan ke `playwright test` (mis. filter file spec),
 * kecuali flag milik wrapper: `--if-up` — bila server target tidak berjalan,
 * suite DILEWATI dengan exit 0 (tidak memulai server baru). Dipakai untuk
 * menjalankan suite terhadap dev server developer yang sedang hidup tanpa
 * risiko memulai server duplikat / menunggu 150s.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  DEFAULT_API_DIR,
  DEFAULT_E2E_TEST_DIR,
  WARMUP_ROUTES,
  buildWarmupRoutes,
  collectSpecWarmupRoutesByFile,
  resolveDevBaseURL,
  tailDeveloperServerLog,
  waitForServer,
  warmRoutes,
} from "../e2e/warmup";
import { E2E_MUTATION_REPORT } from "../e2e/mutation-log";
import { buildRunStats, computeRequestStats } from "./e2e-stats";

const isWin = process.platform === "win32";
const port = process.env.E2E_PORT ?? "3000";
const serverCmd = process.env.E2E_SERVER_CMD ?? "bun run dev";

// Log WRAPPER sendiri (alur + status warm-up ✓/◇/✗ per rute + ringkasan) —
// ditulis ke file di %TEMP% lalu DIGABUNG ke E2E_SERVER_LOG saat selesai,
// supaya artifact CI memuat bagian wrapper (pemanasan) DAN output server
// dalam satu file. File di luar proyek — menulis terus-menerus ke proyek
// merusak watcher Turbopack (lesson dari setup preview paralel).
const wrapperLog = join(tmpdir(), `monsa-e2e-wrapper-${process.pid}.log`);
let wrapperLogFd: number | null = null;
try {
  wrapperLogFd = openSync(wrapperLog, "w");
} catch {
  wrapperLogFd = null;
}

const log = (m: string) => {
  console.log(`[e2e] ${m}`);
  if (wrapperLogFd != null) {
    try {
      writeSync(wrapperLogFd, `[e2e] ${m}\n`);
    } catch {
      // sink log gagal — konsol tetap jalan.
    }
  }
};

// Resolusi server target: E2E_BASE_URL (env) > pidfile dev server
// (.zscripts/dev.pid/.port) > localhost:E2E_PORT. Pidfile tidak dicek
// liveness di sini — probe di main() adalah kewenangannya; pidfile basi
// akan gagal probe dan main() jatuh ke server baru di localhost:E2E_PORT.
const resolved = resolveDevBaseURL();
const pidfileURL = resolved.source === "pidfile" ? resolved.url : null;
const baseURL = resolved.source === "default" ? `http://localhost:${port}` : resolved.url;

// Panjang tail log server yang dicetak saat suite GAGAL (lihat
// printServerLogTail). Bisa di-override lewat E2E_TAIL_LINES agar CI bisa
// meminta tail lebih panjang tanpa mengedit wrapper — diklem 1..1000,
// nilai tidak valid → default 100.
const TAIL_LINES = Math.min(
  1000,
  Math.max(1, Number(process.env.E2E_TAIL_LINES) || 100)
);

// Panjang tail log server STDERR yang dicetak saat suite GAGAL — pasangan
// E2E_TAIL_LINES (lihat readServerLogTail). Diklem 1..1000, nilai tidak
// valid → default 15.
const TAIL_LINES_ERR = Math.min(
  1000,
  Math.max(1, Number(process.env.E2E_TAIL_LINES_ERR) || 15)
);

// Log server developer yang sedang dipakai ulang (reuse mode): ditulis
// .zscripts/dev.sh ke .zscripts/dev.log (stdout+stderr). Dipakai sebagai
// sumber tail kegagalan bila logOut (spawn) maupun E2E_SERVER_LOG tidak ada
// — jadi local --if-up / pidfile failure mendapat diagnosa tanpa env.
const devLogPath = join(process.cwd(), ".zscripts", "dev.log");

// `--if-up`: jangan mulai server baru; suite dilewati (exit 0) bila server
// target tidak berjalan. Flag ini milik wrapper — jangan diteruskan ke
// `playwright test`.
const ifUp = process.argv.includes("--if-up");
const fwdArgs = process.argv.slice(2).filter((a) => a !== "--if-up");
// `--` (pemisah opsional flag wrapper vs arg Playwright) juga tidak
// diteruskan: `playwright test -- public.spec.ts` justru menjalankan SEMUA
// test (58), karena `--` dianggap filter posisional match-all — verifikasi
// live: bentuk kanonik `playwright test public.spec.ts` filter 7 test.
if (fwdArgs[0] === "--") fwdArgs.shift();

// Log server di luar direktori proyek — log di dalam proyek merusak watcher
// Turbopack (lesson dari setup preview paralel).
const logOut = join(tmpdir(), `monsa-e2e-server-${process.pid}.log`);
const logErr = `${logOut}.err`;

// E2E_SERVER_LOG (opsional): salin log server + log wrapper (warm-up
// statuses) ke path ini (di dalam proyek) saat wrapper selesai, agar CI bisa
// meng-upload-nya sebagai artifact saat suite gagal. Salinan dibuat SEKALI di
// akhir (bukan menulis terus-menerus ke proyek) supaya watcher Turbopack
// tidak terganggu selama run berlangsung. Di REUSE mode (--if-up / pidfile)
// log server developer (.zscripts/dev.log) ikut digabung ke artifact yang
// sama (default ./server-e2e.log) — local reuse run menghasilkan artifact
// merged ala CI (lihat copyServerLog).
const serverLogCopy = process.env.E2E_SERVER_LOG ?? "";

// E2E_STATS_FILE (opsional): riwayat statistik per run (jsonl, SATU baris
// per run) untuk cek tren non-2xx antar run (scripts/check-non2xx.ts).
// Ditulis SEKALI di akhir (pola sama dengan copyServerLog) — watcher
// Turbopack tidak terganggu. Di CI di-upload sebagai artifact `e2e-stats`.
const E2E_STATS_FILE = process.env.E2E_STATS_FILE ?? "e2e-stats.jsonl";

let spawnedPid: number | null = null;
// Artifact merged (wrapper | server) sudah diproduksi copyServerLog pada
// run ini — auto-triage lalu men-scan artifact itu (bukan log mentah)
// supaya output CI menunjukkan batas section wrapper vs server.
let artifactProducedThisRun = false;

// Peringatan skala dataset / pagination per spec — diisi collectScaleWarnings
// (dipanggil SETELAH suite, SEBELUM cleanup — probe total butuh server hidup)
// dan di-append ke buildSummaryParts (konsol + step summary).
let scaleWarnings: string[] = [];

function killTree(pid: number): void {
  if (isWin) {
    // taskkill /T mematikan seluruh pohon proses (cmd → bunx → node/next).
    // Timeout wajib: spawnSync PowerShell/taskkill bisa menggantung di mesin
    // tertentu dan memblokir exit wrapper (pernah terjadi — server e2e
    // selamat dari cleanup karena wrapper stuck di spawnSync).
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      timeout: 15_000,
    });
  } else {
    try {
      process.kill(-pid, "SIGTERM"); // detached → pemimpin grup proses.
    } catch {
      // proses sudah tidak ada.
    }
  }
}

/** Matikan proses yang mendengarkan di port server e2e kita (fallback Windows). */
function killPortListeners(port: string): void {
  if (!isWin) return;
  // Stop-Process native PowerShell (bukan taskkill — tidak bergantung PATH).
  // Timeout: lihat komentar di killTree — spawnSync tidak boleh menggantung.
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }`,
    ],
    { stdio: "ignore", timeout: 20_000 }
  );
}

function cleanup(): void {
  if (spawnedPid != null) {
    log("memberhentikan server e2e...");
    killTree(spawnedPid);
    // bunx bisa me-reparent proses server di luar pohon cmd (next/node tetap
    // hidup) — fallback: matikan langsung proses yang mendengarkan di port.
    killPortListeners(port);
    spawnedPid = null;
  }
}

for (const [sig, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const) {
  process.on(sig, () => {
    cleanup();
    process.exit(code);
  });
}

async function probe(baseURL: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseURL}/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    void res;
    return true;
  } catch {
    return false;
  }
}

/**
 * Aritmetika jumlah baris per seksi artifact merged — SATU sumber kebenaran
 * yang dipakai copyServerLog (baris log artifact di konsol) DAN
 * buildArtifactLine (baris artifact di step summary), jadi angkanya tidak
 * bisa meleset di antara keduanya. Input adalah teks per seksi SUDAH di-trim
 * sesuai kebiasaan copyServerLog (wrapper trimEnd, server trimStart); total
 * = jumlah baris file merged = wrapper + server + separator (satu baris)
 * bila kedua seksi ada — persis `parts.join("\n\n").split("\n").length`.
 */
function countArtifactSections(
  wrapperText: string,
  serverText: string
): { wrapper: number; server: number; total: number } {
  const wrapper = wrapperText ? wrapperText.split("\n").length : 0;
  const server = serverText ? serverText.split("\n").length : 0;
  const total = wrapper + server + (wrapper && server ? 1 : 0);
  return { wrapper, server, total };
}

function copyServerLog(): void {
  // Path reuse (--if-up / pidfile): wrapper TIDAK spawn server (logOut tidak
  // ada) — server milik developer (.zscripts/dev.log). Untuk artifact
  // CI-style SECARA LOKAL, gabungkan log WRAPPER + .zscripts/dev.log ke
  // target: E2E_SERVER_LOG bila diset, default ./server-e2e.log (nilai CI) —
  // jadi local reuse run menghasilkan artifact merged yang sama dengan CI.
  if (!existsSync(logOut)) {
    const target = serverLogCopy || join(process.cwd(), "server-e2e.log");
    // Jangan menulis ke .zscripts/dev.log itu sendiri (bila E2E_SERVER_LOG
    // menunjuk ke sumber hidup) — hasil merged akan menimpa log server.
    if (resolve(target) === resolve(devLogPath)) {
      log("(reuse) E2E_SERVER_LOG menunjuk .zscripts/dev.log itu sendiri — artifact merged tidak dibuat (tidak menimpa sumber).");
      return;
    }
    if (!existsSync(devLogPath)) {
      log("(reuse) .zscripts/dev.log tidak ada — artifact merged tidak dibuat.");
      return;
    }
    try {
      const parts: string[] = [];
      let wrapperText = "";
      let serverText = "";
      if (existsSync(wrapperLog)) {
        const w = readFileSync(wrapperLog, "utf8").trimEnd();
        if (w) {
          wrapperText = w;
          parts.push(w);
        }
      }
      const s = readFileSync(devLogPath, "utf8").trimStart();
      if (s) {
        serverText = s;
        parts.push(s);
      }
      const merged = parts.join("\n\n");
      writeFileSync(target, merged);
      artifactProducedThisRun = true;
      const c = countArtifactSections(wrapperText, serverText);
      log(
        `artifact ${target}: wrapper ${c.wrapper} baris · server dev.log ` +
          `${c.server} baris (total ${c.total} baris).`
      );
    } catch (err) {
      log(`gagal menyalin server log: ${String(err)}`);
    }
    return;
  }

  // Spawn path: artifact memerlukan E2E_SERVER_LOG (CI selalu menyetelnya).
  if (!serverLogCopy) return;
  try {
    // Gabung log WRAPPER (warm-up statuses ✓/◇/✗, alur) DI ATAS log server —
    // urut kronologis (pemanasan terjadi sebelum suite). Hasilnya satu file
    // artifact yang lengkap: bagian wrapper + output server.
    const parts: string[] = [];
    let wrapperText = "";
    let serverText = "";
    if (existsSync(wrapperLog)) {
      const w = readFileSync(wrapperLog, "utf8").trimEnd();
      if (w) {
        wrapperText = w;
        parts.push(w);
      }
    }
    if (existsSync(logOut)) {
      const s = readFileSync(logOut, "utf8").trimStart();
      if (s) {
        serverText = s;
        parts.push(s);
      }
    }
    const merged = parts.join("\n\n");
    writeFileSync(serverLogCopy, merged);
    artifactProducedThisRun = true;
    let stderrLines = 0;
    if (existsSync(logErr)) {
      copyFileSync(logErr, `${serverLogCopy}.err`);
      stderrLines = readFileSync(logErr, "utf8").split("\n").length;
    }
    const c = countArtifactSections(wrapperText, serverText);
    log(
      `artifact ${serverLogCopy}: wrapper ${c.wrapper} baris · server ` +
        `${c.server} baris · stderr ${stderrLines} baris (total ${c.total} baris).`
    );
  } catch (err) {
    log(`gagal menyalin server log: ${String(err)}`);
  }
}

/**
 * Ringkasan warm-up per spec: deklarasi `// warmup:` mana yang benar-benar
 * di-exercise oleh spec selama run (dari laporan request fixture
 * e2e/mutation-log.ts), plus glyph hasil warm-up per rute (✓/◇/✗) yang
 * discan dari log WRAPPER — sumber & semantik SAMA dengan ringkasan
 * artifact (writeSuccessSummary), jadi format ✓/◇/✗ di sini paritas dengan
 * itu (discope ke deklarasi per spec). Dipanggil setelah suite selesai.
 */
async function printWarmupSummary(): Promise<void> {
  let declaredByFile: Map<string, string[]>;
  try {
    declaredByFile = await collectSpecWarmupRoutesByFile(
      process.env.E2E_TEST_DIR ?? DEFAULT_E2E_TEST_DIR
    );
  } catch {
    return;
  }
  if (declaredByFile.size === 0) return;

  let reportText: string;
  try {
    reportText = await readFile(E2E_MUTATION_REPORT, "utf8");
  } catch {
    log("(tidak ada laporan request — lewati ringkasan warm-up)");
    return;
  }

  // Glyph warm-up per rute dari log WRAPPER (baris `[e2e] ✓/◇/✗ route ->
  // status`) — regex yang SAMA dengan writeSuccessSummary, jadi counts di
  // sini paritas dengan ringkasan artifact. Rute tanpa glyph (log tidak
  // terbaca) tampil sebagai `—`.
  const warmGlyph = readWarmupGlyphs();

  const exercisedByFile = new Map<string, Set<string>>();
  for (const line of reportText.split("\n").filter((l) => l.trim())) {
    try {
      const entry = JSON.parse(line) as { specFile: string; path: string };
      const set = exercisedByFile.get(entry.specFile) ?? new Set<string>();
      set.add(entry.path);
      exercisedByFile.set(entry.specFile, set);
    } catch {
      // baris rusak — abaikan.
    }
  }

  const hit = (requested: Set<string>, declared: string) =>
    [...requested].some(
      (p) => p === declared || p.startsWith(`${declared}/`)
    );

  log("--- ringkasan warm-up per spec ---");
  let used = 0;
  let unused = 0;
  let wOk = 0;
  let wSynth = 0;
  let wFail = 0;
  let totalDeclared = 0;
  for (const [file, declared] of [...declaredByFile.entries()].sort()) {
    const requested = exercisedByFile.get(file) ?? new Set<string>();
    const marks = declared.map((d) => {
      totalDeclared += 1;
      const glyph = warmGlyph.get(d) ?? "—";
      if (glyph === "✓") wOk += 1;
      else if (glyph === "◇") wSynth += 1;
      else if (glyph === "✗") wFail += 1;
      const exercised = hit(requested, d);
      if (exercised) used += 1;
      else unused += 1;
      // Glyph = hasil warm-up (✓/◇/✗ — semantik SAMA dengan ringkasan
      // artifact); suffix menandai deklarasi yang tidak pernah di-exercise
      // spec (stale declaration).
      return `${glyph} ${d}${exercised ? "" : " (tidak terpakai)"}`;
    });
    log(`  ${file}: ${marks.join("  ")}`);
  }
  log(
    `  (${used} deklarasi terpakai · ${unused} tidak terpakai · ` +
      `warm-up ✓ ${wOk} · ◇ ${wSynth} · ✗ ${wFail} — dari ${totalDeclared} deklarasi)`
  );
  log("--------------------------------");
}

/**
 * Peta rute → glyph warm-up (✓/◇/✗) dari log WRAPPER — dipakai printWarmupSummary
 * DAN collectScaleWarnings (total endpoint publik di-probe hanya untuk rute
 * yang warm-up-nya ✓, artinya tanpa auth merespons 200). Sumber & regex sama
 * dengan ringkasan artifact, jadi semantik glyph konsisten di mana pun.
 */
function readWarmupGlyphs(): Map<string, string> {
  const warmGlyph = new Map<string, string>();
  try {
    const text = readFileSync(wrapperLog, "utf8");
    for (const line of text.split("\n")) {
      const m = /^\[e2e\] ([✓◇✗]) (\S+) /.exec(line);
      if (m) warmGlyph.set(m[2], m[1]);
    }
  } catch {
    // log wrapper tidak terbaca — peta kosong (tidak ada probe total).
  }
  return warmGlyph;
}

/**
 * Kumpulkan panggilan API ter-paginasi PER SPEC langsung dari laporan mutasi
 * (fixture e2e/mutation-log.ts mencatat SEMUA request dengan specFile + query
 * string — atribusi EXACT, bukan union semua spec yang menyentuh path).
 * Catat per (spec, path) berapa baris MINIMUM yang dibutuhkan dataset: untuk
 * request `page=N&limit=L`, dataset harus punya ≥ (N-1)*L+1 baris agar
 * halaman N benar-benar terisi.
 *
 * Sinyal yang DIPAKAI hanya `page > 1` (pagination yang benar-benar
 * melampaui halaman pertama): query `?limit=3` / `?limit=1` di log adalah
 * "ambil N terbaru" / probe, BUKAN pagination — menandainya sebagai
 * ketergantungan skala seed hanya menimbulkan false positive.
 */
function parsePaginatedCalls(
  reportText: string
): Map<
  string,
  Map<string, { maxPage: number; minRows: number | null }>
> {
  const bySpec = new Map<
    string,
    Map<string, { maxPage: number; minRows: number | null }>
  >();
  for (const line of reportText.split("\n").filter((l) => l.trim())) {
    let entry: { specFile: string; path: string; query?: string };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!entry.specFile || !entry.path) continue;
    // Query TIDAK wajib ada (laporan dari run sebelum field `query`
    // ditambahkan) — tanpa query, request page>1 tak bisa di-atribusi.
    const sp = new URLSearchParams(entry.query ?? "");
    if (!sp.has("page")) continue;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    if (page <= 1) continue; // halaman 1 = baseline, bukan pagination.
    const limitRaw = Number(sp.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : NaN;
    // Baris minimum agar halaman `page` terisi; bila limit tak diketahui,
    // null (flag tanpa angka).
    const minRows = Number.isFinite(limit) ? (page - 1) * limit + 1 : null;
    const specMap =
      bySpec.get(entry.specFile) ??
      new Map<string, { maxPage: number; minRows: number | null }>();
    const e = specMap.get(entry.path) ?? { maxPage: 1, minRows: null };
    if (page > e.maxPage) {
      e.maxPage = page;
      // Baris minimum dari halaman TERJAUH (paling menuntut).
      e.minRows = minRows ?? e.minRows;
    }
    specMap.set(entry.path, e);
    bySpec.set(entry.specFile, specMap);
  }
  return bySpec;
}

/** Probe total dataset endpoint publik (`?limit=1` → ambil `total`). */
async function probeDatasetTotal(
  target: string,
  pathname: string
): Promise<number | null> {
  try {
    const res = await fetch(`${target}${pathname}?limit=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { total?: unknown };
    return typeof data.total === "number" ? data.total : null;
  } catch {
    return null;
  }
}

/**
 * Peringatan skala dataset / pagination PER SPEC — dibangun dari log server:
 * endpoint mana yang di-paginate suite (halaman > 1 / ukuran halaman kecil),
 * butuh berapa baris minimum (=(maxPage-1)*limit+1), dan berapa total saat
 * ini (di-probe dari API untuk endpoint publik — warm-up ✓ tanpa auth).
 * Tujuan: menandai spec yang BERGANTUNG pada skala seed — bila total seed
 * turun di bawah ambang, assertion pagination ("Halaman X dari Y", jumlah
 * baris) diam-diam berubah / gagal.
 *
 * Dipanggil SETELAH suite, SEBELUM cleanup: probe total butuh server hidup
 * (di reuse mode server developer; di spawn mode server wrapper — restart
 * test menyalakan server-nya sendiri di port yang sama, jadi port tetap
 * merespons di titik ini). Hasil disimpan di `scaleWarnings` untuk
 * buildSummaryParts (konsol + step summary) dan dicetak di sini juga.
 */
async function collectScaleWarnings(target: string): Promise<void> {
  let reportText = "";
  try {
    reportText = await readFile(E2E_MUTATION_REPORT, "utf8");
  } catch {
    // tidak ada laporan mutasi — lewati (tidak bisa atribusi per spec).
    return;
  }
  // Atribusi EXACT per spec (query string di laporan mutasi).
  const bySpec = parsePaginatedCalls(reportText);
  if (bySpec.size === 0) return;

  // Probe total HANYA untuk endpoint publik (warm-up ✓ = 200 tanpa auth) —
  // menghindari 401 noise dan request tak teratribusi di stats. Endpoint
  // di-union dari semua spec yang mem-paginate.
  const warmGlyph = readWarmupGlyphs();
  const pagedPaths = new Set<string>();
  for (const specMap of bySpec.values()) {
    for (const pathname of specMap.keys()) pagedPaths.add(pathname);
  }
  const totals = new Map<string, number | null>();
  for (const pathname of pagedPaths) {
    if (warmGlyph.get(pathname) === "✓") {
      totals.set(pathname, await probeDatasetTotal(target, pathname));
    }
  }

  const lines: string[] = [];
  let seedDependent = 0;
  let endpointCount = 0;
  for (const [spec, specMap] of [...bySpec.entries()].sort()) {
    for (const [pathname, e] of [...specMap.entries()].sort()) {
      endpointCount += 1;
      const total = totals.get(pathname);
      const totalTxt = total == null ? "tak terbaca" : `${total} baris`;
      const needTxt = e.minRows == null ? "?" : String(e.minRows);
      let risk = "";
      if (total != null && e.minRows != null && total >= e.minRows) {
        // Total saat ini sudah ≥ ambang → assertion pagination bergantung
        // pada skala seed; bila seed menyusut, "Halaman X dari Y" berubah
        // diam-diam.
        risk = " · ⚠️ BERGANTUNG skala seed (total ≥ ambang)";
        seedDependent += 1;
      } else if (total != null) {
        // Total < ambang → test membuat baris sendiri untuk melewati ambang
        // (self-provisioned) — jauh lebih tahan terhadap perubahan seed.
        risk = " · baris dibuat test sendiri (seed < ambang)";
      }
      lines.push(
        `⚠️ ${spec}: ${pathname} → page ${e.maxPage} · butuh ≥${needTxt} ` +
          `baris · total ${totalTxt}${risk}`
      );
    }
  }
  if (lines.length === 0) return;
  scaleWarnings = [...lines];
  log("--- peringatan skala dataset / pagination per spec ---");
  for (const l of lines) log(`  ${l}`);
  log(
    `  (${endpointCount} endpoint-spec terpaginasi · ${seedDependent} bergantung skala seed)`
  );
  log("--------------------------------");
}

/**
 * Cetak tail log server saat warm-up GAGAL sebagian — suite tetap berjalan,
 * tapi penyebab kegagalan warm (cold-compile timeout, 500, …) terlihat
 * sebelum test dimulai. Sumber tail SAMA dengan tail suite-gagal
 * (readServerLogTail: spawn logOut / reuse dev.log), jadi diagnosa konsisten.
 */
async function printWarmupFailureTail(failed: number): Promise<void> {
  const { stdout, stderr, source } = await readServerLogTail();
  if (!stdout && !stderr) {
    log(
      `⚠️  ${failed} rute gagal dipanaskan — tidak ada log server yang bisa ` +
        `ditail (set E2E_SERVER_LOG ke log dev server atau pakai .zscripts/dev.log).`
    );
    return;
  }
  const label =
    source === "wrapper"
      ? "log server (spawn)"
      : source === "E2E_SERVER_LOG"
        ? `E2E_SERVER_LOG (${serverLogCopy})`
        : source === "dev.log"
          ? ".zscripts/dev.log (auto-discover)"
          : "log server";
  log(`⚠️  ${failed} rute gagal dipanaskan — tail ${label}:`);
  if (stdout) log(stdout);
  if (stderr) {
    log(`--- stderr (${TAIL_LINES_ERR} baris terakhir) ---`);
    log(stderr);
  }
}

/**
 * Baca ekor log server (stdout lalu stderr bila ada isi) — satu sumber
 * kebenaran untuk konsol wrapper DAN step summary GitHub Actions.
 * Jumlah baris stdout mengikuti E2E_TAIL_LINES (default 100); stderr tetap
 * 15 baris terakhir.
 *
 * Sumber: log server milik wrapper (logOut — path spawn) bila ada; di reuse
 * mode (tanpa logOut) fallback DI-DELEGASIKAN ke tailDeveloperServerLog
 * (e2e/warmup.ts — helper yang sama dengan CLI e2e:warmup): E2E_SERVER_LOG
 * bila menunjuk file yang ada, lalu .zscripts/dev.log. Jadi local failure di
 * reuse mode mendapat diagnosa yang sama tanpa env apa pun, dan logika
 * kandidat tail tidak diduplikasi antara wrapper dan CLI. `source`
 * memberitahu asal tail ("wrapper" | "E2E_SERVER_LOG" | "dev.log").
 */
async function readServerLogTail(
  stdoutLines = TAIL_LINES,
  stderrLines = TAIL_LINES_ERR
): Promise<{ stdout: string; stderr: string; source: string }> {
  if (existsSync(logOut)) {
    // Spawn path: log server milik wrapper (logOut + logErr terpisah).
    let stdout = "";
    let stderr = "";
    try {
      const text = await readFile(logOut, "utf8");
      stdout = text.split("\n").slice(-stdoutLines).join("\n").trim();
    } catch {
      // tidak terbaca — abaikan.
    }
    if (existsSync(logErr)) {
      try {
        const text = await readFile(logErr, "utf8");
        if (text.trim()) {
          stderr = text.split("\n").slice(-stderrLines).join("\n").trim();
        }
      } catch {
        // tidak terbaca — abaikan.
      }
    }
    return { stdout, stderr, source: "wrapper" };
  }

  // Reuse path: server milik developer — delegasikan fallback log developer
  // (E2E_SERVER_LOG → .zscripts/dev.log) ke helper bersama. Helper hanya
  // mengembalikan SATU teks (dev.log sudah stdout+stderr 2>&1), jadi stderr
  // reuse mode tetap kosong — tidak ada pasangan `.err` di path ini.
  const tail = await tailDeveloperServerLog(stdoutLines);
  if (!tail) return { stdout: "", stderr: "", source: "" };
  return { stdout: tail.text, stderr: "", source: tail.source };
}

/**
 * Cetak ekor log server ke output wrapper (stdout lalu stderr bila ada isi)
 * saat suite GAGAL — supaya konsol workflow CI seringkali cukup untuk
 * diagnosa (stall cold-compile Turbopack, 500, dll.) tanpa mengunduh
 * artifact. Jumlah baris mengikuti E2E_TAIL_LINES (stdout) dan
 * E2E_TAIL_LINES_ERR (stderr). Tidak dicetak saat sukses.
 */
async function printServerLogTail(
  header: string,
  stdoutLines = TAIL_LINES,
  stderrLines = TAIL_LINES_ERR
): Promise<void> {
  const { stdout, stderr, source } = await readServerLogTail(stdoutLines, stderrLines);
  log(header);
  if (source === "E2E_SERVER_LOG") {
    log(`(reuse: log server developer dipakai ulang — tail dari ${serverLogCopy})`);
  } else if (source === "dev.log") {
    log("(reuse: log server developer dipakai ulang — tail dari .zscripts/dev.log)");
  }
  if (stdout) log(stdout);
  if (stderr) {
    log(`--- stderr (${stderrLines} baris terakhir) ---`);
    log(stderr);
  }
}

/**
 * GitHub Actions: tulis SATU section `##` berisi ekor log server + verdict
 * triage ke $GITHUB_STEP_SUMMARY agar render INLINE di UI workflow (tidak
 * perlu buka artifact). Tidak berfungsi di luar GitHub Actions (var kosong
 * → dilewati).
 *
 * Sejak auto-triage ditambahkan, tail log & triage TIDAK lagi di-append
 * sebagai blok terpisah setelah heading (dua `###` tambahan); keduanya
 * dibangun dalam satu panggilan ini sehingga seluruh diagnosa gagal berada
 * di bawah satu heading `##` — sub-blok `### stderr`, `### 🔎 Triage
 * kegagalan (otomatis)`, dan `### 🔎 Triage payload (JSON — untuk bot/CI)`
 * hanyalah bagian dari section yang sama.
 *
 * Header TIDAK lagi menyertakan link ke Playwright report: sejak step
 * "Link playwright-report artifact in step summary" (post-upload) ada di
 * workflow, summary hanya punya SATU link report — blok `### 🔗` dengan URL
 * langsung artifact (fallback halaman artifacts). Link di heading dihapus
 * agar tidak dobel dengan blok tersebut.
 *
 * Format heading `server log tail (N baris stdout · M baris stderr)` adalah
 * kontrak dengan step CI "Check tail heading matches E2E_TAIL_LINES" — jangan
 * ubah tanpa menyesuaikan grep di .github/workflows.
 */
async function writeStepSummary(code: number, triage?: TriageOutcome): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    const { stdout, stderr } = await readServerLogTail();
    const blocks: string[] = [
      `## ⚠️ E2E failed (exit ${code}) — server log tail (${TAIL_LINES} baris stdout · ${TAIL_LINES_ERR} baris stderr)`,
      "",
    ];
    if (stdout) blocks.push("```text", stdout, "```", "");
    if (stderr) blocks.push("### stderr", "", "```text", stderr, "```", "");
    if (triage?.report) {
      blocks.push(
        "### 🔎 Triage kegagalan (otomatis)",
        "",
        "```text",
        triage.report.trim(),
        "```",
        ""
      );
    }
    if (triage?.payloadJson) {
      blocks.push(
        "### 🔎 Triage payload (JSON — untuk bot/CI)",
        "",
        "```json",
        triage.payloadJson.trim(),
        "```",
        ""
      );
    }
    // Ringkasan server TIGA bagian yang SAMA dengan run sukses (warm-up
    // ✓/◇/✗ + request per method/non-2xx + baris per seksi artifact) — jadi
    // step summary tiap run seragam: pembeda hanya heading (✅/⚠️) + tail +
    // triage di jalur merah. Log() di bawah dibuat SETELAH buildSummaryParts
    // agar snapshot wrapperLog identik dengan jalur sukses (buildArtifactLine
    // membaca wrapperLog lagi setelahnya, sama seperti writeSuccessSummary).
    const summaryParts = await buildSummaryParts();
    if (summaryParts.length > 0) {
      blocks.push("### 📊 Ringkasan server", "", ...summaryParts, "");
      log(`ringkasan server (gagal): ${summaryParts.join(" · ")}`);
    }
    const artifactLine = buildArtifactLine();
    if (artifactLine) blocks.push(`${artifactLine}\n`);
    appendFileSync(summaryPath, blocks.join("\n") + "\n");
    log(`step summary ditulis ke ${summaryPath}`);
  } catch (err) {
    log(`gagal menulis step summary: ${String(err)}`);
  }
}

/**
 * GitHub Actions: append verdict triage ke $GITHUB_STEP_SUMMARY (di bawah
 * tail log server yang sudah ditulis writeStepSummary) agar render inline
 * di UI workflow. Tidak berfungsi di luar GitHub Actions (var kosong → no-op).
 */
/** Baca log server (urutan fallback sama dengan tail gagal); "" bila kosong. */
async function readServerLogText(): Promise<string> {
  let serverSrc = "";
  if (existsSync(logOut)) serverSrc = logOut;
  else if (serverLogCopy && existsSync(serverLogCopy)) serverSrc = serverLogCopy;
  else if (pidfileURL && existsSync(devLogPath)) serverSrc = devLogPath;
  if (!serverSrc) return "";
  try {
    return await readFile(serverSrc, "utf8");
  } catch {
    return "";
  }
}

/**
 * Ringkasan artifact untuk run SUKSES: statistik warm-up (✓/◇/✗ dari log
 * wrapper) + jumlah request per method & non-2xx (dari log server) di-append
 * ke $GITHUB_STEP_SUMMARY sebagai section hijau, lalu baris per seksi
 * artifact (wrapper/server/stderr) ikut ditambahkan — dibaca SETELAH log()
 * fungsi ini agar snapshot wrapperLog identik dengan copyServerLog, jadi
 * angkanya selalu sama dengan baris ringkasan artifact di konsol. Konsol
 * mendapat bagian warm-up + request di sini (ikut tergabung ke artifact
 * server-e2e.log karena dipanggil SEBELUM copyServerLog) dan baris artifact
 * dari copyServerLog sendiri.
 */
/**
 * TIGA bagian ringkasan run yang SERAGAM di setiap step summary (sukses
 * MAUPUN gagal): (1) statistik warm-up ✓/◇/✗ dari log wrapper, (2) jumlah
 * request per method & non-2xx dari log server, (3) baris per seksi artifact
 * (wrapper/server/stderr). Dipakai writeSuccessSummary (run hijau) dan
 * writeStepSummary (run merah) — jadi formatnya identik di kedua jalur.
 * Mengembalikan array baris (bisa kosong bila log tidak terbaca).
 */
async function buildSummaryParts(): Promise<string[]> {
  const parts: string[] = [];

  // Statistik warm-up dari log wrapper (baris `[e2e] ✓/◇/✗ route -> status`).
  if (existsSync(wrapperLog)) {
    try {
      const text = await readFile(wrapperLog, "utf8");
      let ok = 0;
      let synth = 0;
      let fail = 0;
      for (const line of text.split("\n")) {
        const m = /^\[e2e\] ([✓◇✗]) /.exec(line);
        if (!m) continue;
        if (m[1] === "✓") ok += 1;
        else if (m[1] === "◇") synth += 1;
        else fail += 1;
      }
      if (ok + synth + fail > 0) {
        parts.push(
          `warm-up ${ok + synth + fail} rute (✓ ${ok} · ◇ ${synth} · ✗ ${fail})`
        );
      }
    } catch {
      // log wrapper tidak terbaca — lewati statistik warm-up.
    }
  }

  // Jumlah request dari log server (urutan fallback sama dengan tail gagal).
  const serverText = await readServerLogText();
  if (serverText) {
    const stats = computeRequestStats(serverText.split("\n"));
    if (stats.total > 0) {
      const methods = Object.entries(stats.byMethod)
        .sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `${m} ${n}`)
        .join(" · ");
      parts.push(
        `request ${stats.total} (${methods}) · non-2xx ${stats.non2xx}`
      );
    }
  }

  // Peringatan skala dataset / pagination per spec — diisi collectScaleWarnings
  // (setelah suite, sebelum cleanup) supaya konsol DAN step summary (sukses
  // maupun gagal) menampilkan spec yang bergantung pada skala seed. Tiap baris
  // jadi elemen parts sendiri: di step summary render per baris (\n), di
  // konsol satu baris ringkasan yang tetap greppable per item (· ).
  for (const w of scaleWarnings) parts.push(w);

  return parts;
}

/**
 * Baris artifact (bagian ke-3 dari ringkasan seragam) — dibaca SETELAH
 * pemanggil menulis log() ringkasan (log wrapper ikut bertambah), jadi
 * snapshot wrapperLog identik dengan yang dibaca copyServerLog sesudahnya:
 * angka step summary selalu sama dengan baris ringkasan artifact di konsol.
 * Aritmetika sama dengan copyServerLog (wrapper trim-end, server trim-start,
 * stderr mentah + total dengan separator). Hanya saat artifact benar-benar
 * diproduksi: spawn path (+ E2E_SERVER_LOG set) ATAU reuse path (dev.log ada
 * & target bukan dev.log itu sendiri). "" bila tidak berlaku / tidak terbaca.
 */
function buildArtifactLine(): string {
  const reuseArtifact =
    !existsSync(logOut) &&
    existsSync(devLogPath) &&
    resolve((serverLogCopy || join(process.cwd(), "server-e2e.log"))) !==
      resolve(devLogPath);
  if (!((serverLogCopy && existsSync(logOut)) || reuseArtifact)) return "";
  try {
    const target = serverLogCopy || join(process.cwd(), "server-e2e.log");
    const w = existsSync(wrapperLog)
      ? readFileSync(wrapperLog, "utf8").trimEnd()
      : "";
    const serverSrc = existsSync(logOut) ? logOut : devLogPath;
    const s = readFileSync(serverSrc, "utf8").trimStart();
    // Aritmetika sama dengan copyServerLog — helper bersama, angkanya
    // tidak bisa meleset di antara konsol dan step summary.
    const { wrapper: wLines, server: sLines, total } = countArtifactSections(w, s);
    let errLines = 0;
    if (existsSync(logOut) && existsSync(logErr)) {
      errLines = readFileSync(logErr, "utf8").split("\n").length;
    }
    return `artifact ${target}: wrapper ${wLines} baris · server ${sLines} baris · stderr ${errLines} baris (total ${total} baris)`;
  } catch {
    // log artifact tidak terbaca — lewati bagian ini.
    return "";
  }
}

async function writeSuccessSummary(): Promise<void> {
  const parts = await buildSummaryParts();
  if (parts.length === 0) return;
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  log(`ringkasan sukses: ${parts.join(" · ")}`);
  if (!summaryPath) return;
  try {
    // Step summary multi-baris (lebih mudah discan); konsol tetap satu baris.
    appendFileSync(
      summaryPath,
      `## ✅ E2E passed — server log summary\n\n${parts.join("\n")}\n\n`
    );
    log(`ringkasan sukses ditambahkan ke step summary ${summaryPath}`);
  } catch (err) {
    log(`gagal menulis ringkasan sukses ke step summary: ${String(err)}`);
  }

  // Bagian artifact (baris per seksi) — dibaca SETELAH log() di atas (log
  // wrapper ikut bertambah), jadi snapshot wrapperLog identik dengan yang
  // dibaca copyServerLog sesudahnya: angka step summary selalu sama dengan
  // baris ringkasan artifact di konsol.
  const artifactLine = buildArtifactLine();
  if (summaryPath && artifactLine) {
    appendFileSync(summaryPath, `${artifactLine}\n\n`);
  }
}

/**
 * Riwayat statistik per run (jsonl, SATU baris per run) untuk cek tren
 * non-2xx antar run: jumlah request & non-2xx + daftar entri non-2xx dengan
 * atribusi spec (via laporan mutasi fixture). Ditulis di SETIAP run (sukses
 * maupun gagal) SEBELUM copyServerLog — baris log ikut tergabung ke
 * artifact. Skema baris dipakai bersama scripts/check-non2xx.ts.
 */
async function writeRunStats(): Promise<void> {
  const serverText = await readServerLogText();
  let reportText = "";
  try {
    reportText = await readFile(E2E_MUTATION_REPORT, "utf8");
  } catch {
    // tidak ada laporan mutasi — entri non-2xx tanpa atribusi spec.
  }
  const runId = Number(process.env.GITHUB_RUN_ID ?? 0) || null;
  const entry = buildRunStats({
    serverLogText: serverText,
    reportText,
    runId,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    branch: process.env.GITHUB_REF_NAME ?? null,
  });
  try {
    appendFileSync(E2E_STATS_FILE, `${JSON.stringify(entry)}\n`);
    log(
      `e2e-stats: ${entry.requests.non2xx} non-2xx dari ${entry.requests.total} request → ${E2E_STATS_FILE}`
    );
  } catch (err) {
    log(`gagal menulis e2e-stats: ${String(err)}`);
  }
}

/**
 * FALLBACK untuk triageVerdictFromJson: derives a single greppable VERDICT
 * line dari laporan MANUSIA triage (regex) — dipakai hanya bila payload JSON
 * tidak punya verdict/counts (format berubah / crash). Laporan manusia
 * berbentuk:
 *   - `Verdict: warmup-failed — <teks>` (wrapperWarning — warm-up gagal diam-diam),
 *   - `Verdict: N stall · N dns · N timeout → <reason>` (temuan ada), atau
 *   - `✅ Tidak ada pola stall/DNS/timeout ...` (clean).
 * Severity tag: warmup-failed > cold-compile (stall) > network (dns) >
 * assertion (else), matching kategori verdict triage, plus `clean`.
 * Returns null when the format is unrecognized (script changed).
 */
function triageVerdictLine(stdout: string): string | null {
  const w =
    /Verdict:\s*warmup-failed\s*—\s*(.*)$/m.exec(stdout);
  if (w) {
    return `VERDICT: warmup-failed (0 stall · 0 dns · 0 timeout · 0 error) — ${w[1].trim()}`;
  }
  const m =
    /Verdict:\s*(\d+)\s*stall · (\d+)\s*dns · (\d+)\s*timeout\s*→\s*(.*)$/m.exec(
      stdout
    );
  if (m) {
    const stalls = Number(m[1]);
    const dns = Number(m[2]);
    const timeouts = Number(m[3]);
    const reason = m[4].trim();
    const severity =
      stalls > 0 ? "cold-compile" : dns > 0 ? "network" : "assertion";
    return `VERDICT: ${severity} (${stalls} stall · ${dns} dns · ${timeouts} timeout) — ${reason}`;
  }
  if (stdout.includes("Tidak ada pola stall/DNS/timeout")) {
    return "VERDICT: clean (0 stall · 0 dns · 0 timeout) — tidak ada pola stall/DNS/timeout yang dikenal.";
  }
  return null;
}

/**
 * Derives a single greppable VERDICT line dari payload JSON triage
 * (`triage:e2e -- --json`): severity = payload.verdict (warmup-failed |
 * cold-compile | network | assertion | clean), counts dari payload.counts,
 * alasan dari payload.reason (satu sumber kebenaran dengan triage), jatuh
 * ke teks lokal bila payload lama tanpa reason. Fallback ke triageVerdictLine
 * (regex laporan manusia) bila payload tidak punya verdict/counts —
 * stderrText memuat laporan manusia karena mode --json mengalihkannya ke
 * stderr.
 */
function triageVerdictFromJson(payload: unknown, stderrText: string): string {
  const p = (payload ?? {}) as {
    verdict?: string;
    error?: string;
    reason?: string;
    wrapperWarning?: string;
    counts?: {
      stalls?: number;
      slow?: number;
      dns?: number;
      timeouts?: number;
      errors?: number;
    };
  };
  const stalls = Number(p.counts?.stalls) || 0;
  const dns = Number(p.counts?.dns) || 0;
  const timeouts = Number(p.counts?.timeouts) || 0;
  const errors = Number(p.counts?.errors) || 0;
  const decisive = stalls + dns + timeouts + errors;
  if (p.verdict === "clean") {
    return "VERDICT: clean (0 stall · 0 dns · 0 timeout · 0 error) — tidak ada pola stall/DNS/timeout yang dikenal.";
  }
  if (p.verdict === "warmup-failed") {
    // Kategori khusus warm-up gagal diam-diam (section wrapper terlalu kecil
    // / status jauh di bawah deklarasi) — counts sering 0, jadi alasan datang
    // dari payload.reason (= teks wrapperWarning triage).
    const reason =
      p.reason ||
      p.wrapperWarning ||
      "warm-up kemungkinan gagal diam-diam (section wrapper terlalu kecil) — periksa status warm-up di artifact.";
    return `VERDICT: warmup-failed (${stalls} stall · ${dns} dns · ${timeouts} timeout · ${errors} error) — ${reason}`;
  }
  if (p.verdict || decisive) {
    // Alasan dari payload.reason bila ada (satu sumber kebenaran dengan
    // triage); payload lama tanpa reason jatuh ke teks lokal yang sama
    // dengan yang dulu.
    const reason =
      p.reason ||
      (stalls > 0
        ? "kemungkinan cold-compile Turbopack (lihat e2e/warmup.ts) — jalankan ulang dengan cache panas."
        : dns > 0
          ? "masalah jaringan/eksternal — cek koneksi & layanan yang dipanggil."
          : "kegagalan assertion — lihat error-context di atas.");
    return `VERDICT: ${p.verdict ?? "unknown"} (${stalls} stall · ${dns} dns · ${timeouts} timeout · ${errors} error) — ${reason}`;
  }
  if (p.error) {
    return `VERDICT: unknown — triage gagal dijalankan: ${String(p.error)}`;
  }
  return (
    triageVerdictLine(stderrText) ??
    "VERDICT: unknown — payload triage tidak dapat di-parse."
  );
}

/** Hasil runTriage: laporan manusia + payload JSON mentah triage. */
interface TriageOutcome {
  report: string;
  payloadJson: string;
}

/**
 * Jalankan script triage kegagalan (scripts/triage-e2e.ts --json) setelah
 * suite GAGAL dan cetak verdict-nya ke output wrapper (konsol + log wrapper,
 * jadi ikut tergabung ke artifact server-e2e.log via copyServerLog).
 * Subprocess terpisah — triage-e2e.ts langsung mengeksekusi main() saat
 * di-import, sehingga tidak bisa dipanggil inline.
 *
 * Mode --json: stdout = SATU baris JSON payload (verdict, counts, temuan
 * per-kategori, wrapperWarning, sections); laporan manusia ([e2e:triage] ...)
 * dialihkan ke stderr. Laporan manusia dipakai sebagai isi step summary
 * (return), payload JSON dipakai untuk baris VERDICT yang greppable.
 *
 * Env E2E_SERVER_LOG diarahkan ke artifact MERGED (wrapper | server) bila
 * copyServerLog sudah memproduksinya di run ini — scan triage lalu melihat
 * batas section (wrapper vs server) dan peringatan kesehatan warm-up di
 * output CI. Bila belum (mis. reuse tanpa dev.log), jatuh ke log server
 * mentah (path spawn) atau biarkan fallback triage sendiri (reuse).
 *
 * Exit code triage (0/1) DIABAIKAN untuk hasil wrapper — suite sudah gagal;
 * verdict triage adalah diagnosa, bukan status baru. Mengembalikan
 * { report, payloadJson }: laporan manusia (stderr) untuk blok teks step
 * summary + payload JSON mentah (stdout) untuk konsumen bot/CI.
 */
async function runTriage(): Promise<TriageOutcome> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Utamakan artifact MERGED (wrapper | server) bila sudah diproduksi run
  // ini — batas section terlihat di output triage (detectSections), bukan
  // "log mentah". Bila belum, jatuh ke log server mentah (spawn) atau
  // biarkan fallback triage sendiri (reuse tanpa artifact).
  if (artifactProducedThisRun) {
    env.E2E_SERVER_LOG =
      serverLogCopy || join(process.cwd(), "server-e2e.log");
  } else if (existsSync(logOut)) {
    env.E2E_SERVER_LOG = logOut;
  }
  log("menjalankan triage kegagalan (scripts/triage-e2e.ts --json)...");
  const res = spawnSync("bunx tsx scripts/triage-e2e.ts --json", {
    shell: true,
    env,
    encoding: "utf8",
    timeout: 90_000,
  });
  if (res.error) {
    log(`triage tidak dapat dijalankan: ${String(res.error)}`);
    // Tetap jamin SATU baris greppable `VERDICT:` per run yang gagal —
    // konsol + artifact merged bisa discan `grep VERDICT:` tanpa perlu
    // tahu apakah triage sempat berjalan.
    log(`VERDICT: unknown — triage tidak dapat dijalankan: ${String(res.error)}`);
    return { report: "", payloadJson: "" };
  }
  const stdout = (res.stdout ?? "").toString().trim();
  const stderrText = (res.stderr ?? "").toString().trim();
  // Payload JSON (stdout) — satu baris; laporan manusia = stderr. Bila
  // payload gagal di-parse, VERDICT jatuh ke fallback regex di stderrText.
  let payload: unknown = null;
  let payloadJson = "";
  try {
    payload = JSON.parse(stdout);
    payloadJson = stdout;
  } catch {
    payload = null;
  }
  const report = stderrText || stdout;
  let summaryText = report;
  if (report) {
    log("--- triage kegagalan (scripts/triage-e2e.ts --json) ---");
    for (const line of report.split("\n")) log(line);
    log("----------------------------------------------");
    // Satu baris greppable `VERDICT:` per run yang gagal — konsol, log
    // wrapper (artefak merged), dan step summary (via writeStepSummary,
    // yang menyatukan tail + verdict dalam satu section) semuanya
    // memakainya untuk diagnosa cepat tanpa membaca seluruh output.
    const verdictLine = triageVerdictFromJson(payload, stderrText);
    log(verdictLine);
    // WARM-UP WARNING greppable — payload.wrapperWarning (warnWrapperHealth
    // triage) menandai warm-up yang mungkin GAGAL DIAM-DIAM (section wrapper
    // terlalu kecil / status rute jauh di bawah deklarasi). Satu baris
    // `WARM-UP WARNING:` per run, pola sama dengan `VERDICT:` — konsol,
    // artifact merged, dan step summary. (Baris `⚠️` yang sama sudah ada di
    // laporan manusia triage — di sini disurface sebagai sinyal greppable.)
    let warmupWarningLine = "";
    const ww = (payload as { wrapperWarning?: unknown } | null)?.wrapperWarning;
    if (typeof ww === "string" && ww) {
      warmupWarningLine = `WARM-UP WARNING: ${ww}`;
      log(warmupWarningLine);
    }
    // Mode --json tidak mengeluarkan baris `Verdict:` manusia (printJson
    // menggantinya), jadi VERDICT wrapper ditambahkan ke laporan agar blok
    // triage di step summary tetap berakhir dengan kesimpulannya.
    summaryText =
      `${report}${warmupWarningLine ? `\n${warmupWarningLine}` : ""}\n` +
      verdictLine;
  } else {
    log("triage tidak menghasilkan output.");
    log("VERDICT: unknown — triage tidak menghasilkan output.");
  }
  if (res.status != null && res.status > 1) {
    log(`triage exit ${res.status} (di luar 0/1 — cek scripts/triage-e2e.ts).`);
  }
  return { report: summaryText, payloadJson };
}

/**
 * Log sumber tail kegagalan untuk reuse mode (--if-up / pidfile) — dicetak
 * di startup (setelah "server dipakai ulang") agar developer langsung tahu
 * dari mana tail akan diambil bila suite gagal. Prioritas SAMA dengan
 * readServerLogTail yang men-delegasikan ke tailDeveloperServerLog:
 * E2E_SERVER_LOG bila menunjuk file yang ada, lalu .zscripts/dev.log (bila
 * ada). Bila logOut ada (server di-spawn wrapper), sumbernya jelas — fungsi
 * ini tidak dipanggil.
 */
function logReuseTailSources(): void {
  if (serverLogCopy && existsSync(serverLogCopy)) {
    log(`(reuse) tail kegagalan akan diambil dari E2E_SERVER_LOG: ${serverLogCopy}`);
  } else if (existsSync(devLogPath)) {
    log("(reuse) tail kegagalan akan diambil dari .zscripts/dev.log (auto-discover)");
  } else {
    log("(reuse) TIDAK ADA sumber tail kegagalan — set E2E_SERVER_LOG ke log server Anda agar failure mendapat diagnosa.");
  }
}

async function main(): Promise<number> {
  log(`baseURL=${baseURL} · serverCmd=${serverCmd}`);
  if (pidfileURL) {
    log(`port dev server terdeteksi dari .zscripts/dev.pid/.port -> ${pidfileURL}`);
  }

  let target = baseURL;
  if (await probe(target)) {
    log(`server sudah berjalan di ${target} — dipakai ulang.`);
    // Reuse mode (server milik developer): wrapper tidak punya log sendiri
    // (logOut tidak dibuat), jadi tail kegagalan nanti diambil dari sumber
    // reuse. Log sumbernya SEKARANG (terminal discoverability) — urutan
    // prioritas sama dengan readServerLogTail: E2E_SERVER_LOG (bila ada)
    // > .zscripts/dev.log (bila pidfile). Tanpa keduanya, tail kosong.
    logReuseTailSources();
  } else if (ifUp) {
    log(`tidak ada server di ${target} — dilewati (--if-up), suite tidak dijalankan.`);
    return 0;
  } else {
    if (pidfileURL) {
      // Pidfile basi (server di port itu mati) — jangan menunggu port lama;
      // mulai server baru di E2E_PORT seperti perilaku default.
      target = `http://localhost:${port}`;
      log(`pidfile ${pidfileURL} tidak merespons — memulai server baru di ${target}.`);
    }
    log(`tidak ada server di ${target} — memulai \`${serverCmd}\` (log: ${logOut})...`);
    const server = spawn(serverCmd, {
      shell: true,
      detached: !isWin,
      stdio: ["ignore", openSync(logOut, "a"), openSync(logErr, "a")],
      env: process.env,
    });
    spawnedPid = server.pid ?? null;

    const up = await waitForServer(target, { log, attempts: 30, intervalMs: 5_000 });
    if (!up) {
      await printServerLogTail("server tidak merespons setelah 150s — tail log:");
      cleanup();
      // Startup gagal = kegagalan juga: beri perlakuan verdict yang SAMA
      // dengan suite gagal (tail → auto-triage → step summary SATU section
      // yang menggabungkan tail + verdict). copyServerLog dipanggil DULU
      // agar auto-triage men-scan artifact merged (batas section wrapper vs
      // server terlihat di output CI), lalu dipanggil LAGI di bawah setelah
      // runTriage — output triage ikut tergabung ke artifact server-e2e.log,
      // persis seperti jalur suite-gagal di bawah.
      copyServerLog();
      const triage = await runTriage();
      await writeStepSummary(1, triage);
      copyServerLog();
      return 1;
    }
    log("server siap.");
  }

  const { routes, synthetic, declared, apiRoutes } = await buildWarmupRoutes({
    testDir: process.env.E2E_TEST_DIR ?? DEFAULT_E2E_TEST_DIR,
    apiDir: process.env.E2E_API_DIR ?? DEFAULT_API_DIR,
  });
  log(
    `memanaskan ${routes.length} rute ` +
      `(default ${WARMUP_ROUTES.length} · spec ${declared.length} · ` +
      `API ${apiRoutes.length} · dinamis ${synthetic.size})...`
  );
  const warmupFailed = await warmRoutes(target, { log, routes, synthetic });
  if (warmupFailed > 0) {
    // Rute gagal dipanaskan (cold-compile timeout, 500, dst.) — suite tetap
    // dijalankan, tapi tail log server sekarang memberi konteks: penyebab
    // kegagalan warm biasanya terlihat di sini sebelum test mulai. Sumber
    // tail sama dengan tail suite-gagal (readServerLogTail — spawn logOut /
    // reuse dev.log), jadi konsisten dengan diagnosa lainnya.
    await printWarmupFailureTail(warmupFailed);
  }

  const args = fwdArgs;
  log(`menjalankan: playwright test${args.length ? ` ${args.join(" ")}` : ""}`);
  // Satu string perintah (bukan array arg) dengan shell:true — menghindari
  // DeprecationWarning DEP0190 dan masalah quoting di cmd/PowerShell.
  const pwCmd = ["bunx", "playwright", "test", ...args].join(" ");
  const code = await new Promise<number>((resolve) => {
    const pw = spawn(pwCmd, {
      shell: true,
      stdio: "inherit",
      env: {
        ...process.env,
        PW_REUSE_SERVER: "1",
        E2E_BASE_URL: target,
        E2E_PORT: port,
        E2E_SERVER_CMD: serverCmd,
      },
    });
    pw.on("exit", (c) => resolve(c ?? 1));
    pw.on("error", (err) => {
      log(`gagal menjalankan Playwright: ${String(err)}`);
      resolve(1);
    });
  });

  // Peringatan skala dataset / pagination per spec — SEBELUM cleanup (probe
  // total butuh server hidup; di reuse mode server developer tetap hidup,
  // di spawn mode restart test menyalakan server-nya sendiri di port yang
  // sama). Hasil dicetak di sini DAN di-append ke buildSummaryParts.
  await collectScaleWarnings(target);

  cleanup();
  if (code !== 0) {
    await printServerLogTail(`suite GAGAL (exit ${code}) — tail log server:`);
    // Bangun artifact merged DULU agar auto-triage men-scan artifact (bukan
    // log server mentah) — batas section wrapper vs server lalu terlihat di
    // output CI. copyServerLog di akhir main() menggabungkan ulang sehingga
    // output triage (baris log() selama runTriage) ikut masuk artifact.
    copyServerLog();
    const triage = await runTriage();
    await writeStepSummary(code, triage);
  }
  await printWarmupSummary();
  if (code === 0) {
    // Sebelum copyServerLog — log() di dalamnya ikut tergabung ke artifact.
    await writeSuccessSummary();
  }
  // Riwayat non-2xx per run — SELALU ditulis (hijau maupun merah) agar cek
  // tren antar run (scripts/check-non2xx.ts) punya baseline di tiap run.
  await writeRunStats();
  copyServerLog();
  return code;
}

main().then((code) => process.exit(code));
