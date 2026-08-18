/**
 * Triage kegagalan E2E — scan log server + laporan Playwright untuk pola
 * kegagalan yang dikenal, sehingga diagnosa pertama bisa langsung dari
 * konsol tanpa membongkar artifact satu per satu.
 *
 * Jalankan SETELAH test:e2e yang gagal (lokal maupun CI). Dua sumber:
 *   1. Log server — berisi baris seperti
 *        `DELETE /api/news/<id> 200 in 5.3s (proxy.ts: 11ms)`
 *      Durasi > 5s pada mutasi = stall cold-compile Turbopack (handler
 *      pertama kali di-compile saat test menyentuhnya — lihat e2e/warmup.ts).
 *   2. Laporan Playwright — test-results/**\/*.md (error-context) dan
 *      playwright-report/index.html — berisi pesan timeout/assertion &
 *      error jaringan yang sebenarnya.
 *
 * Kategori yang dideteksi:
 *   - STALL   : POST/PUT/DELETE/PATCH >= TRIAGE_STALL_MS (default 5_000 ms)
 *   - SLOW    : method lain >= TRIAGE_SLOW_MS (default 10_000 ms) — info saja
 *   - DNS     : ENOTFOUND / EAI_AGAIN / getaddrinfo / fetch failed /
 *               ECONNREFUSED / ECONNRESET / ETIMEDOUT / dll (kedua sumber)
 *   - TIMEOUT : pesan timeout Playwright (laporan saja)
 *   - ERROR   : baris Error/AssertionError/TypeError di error-context
 *
 * Exit code: 0 = tidak ada pola dikenal, 1 = ada temuan (bisa dipakai CI
 * untuk meng-annotasi run).
 *
 * Mode --json: stdout membawa SATU baris JSON untuk konsumsi mesin
 * (CI / bot) — lihat printJson untuk bentuknya; diagnostik manusia
 * dialihkan ke stderr. Exit code sama dengan mode manusia (0/1/2).
 *
 * Flag --section <wrapper|server>: batasi analisa ke SATU section artifact
 * merged — temuan dari section lain dan dari laporan Playwright (yang
 * tidak punya section) tidak dihitung; verdict/counts/exit code ikut
 * scoped (analisa section-scoped). Tanpa flag = semua section. Berlaku
 * untuk mode manusia maupun --json (payload membawa `section`).
 *
 * Env:
 *   TRIAGE_STALL_MS   ambang stall mutasi, ms (default 5000)
 *   TRIAGE_SLOW_MS    ambang lambat method lain, ms (default 10000)
 *   E2E_SERVER_LOG    path log server (default ./server-e2e.log, lalu
 *                     fallback ke log server e2e terbaru di %TEMP%)
 *   E2E_TEST_RESULTS  direktori hasil Playwright (default ./test-results)
 *   E2E_PLAYWRIGHT_REPORT  direktori report HTML Playwright (default
 *                     ./playwright-report) — bisa menunjuk lokasi unduhan
 *                     artifact untuk analisa post-hoc (triage.yml).
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STALL_MS = Number(process.env.TRIAGE_STALL_MS ?? 5_000);
const SLOW_MS = Number(process.env.TRIAGE_SLOW_MS ?? 10_000);
const MUTATING = new Set(["POST", "PUT", "DELETE", "PATCH"]);

// Mode JSON (--json): stdout membawa SATU baris JSON yang bisa dikonsumsi
// mesin (CI / bot); diagnostik manusia dialihkan ke stderr. Exit code sama
// (0 = tidak ada pola, 1 = ada temuan, 2 = error). Tanpa flag, output
// manusia seperti biasa di stdout.
const jsonMode = process.argv.includes("--json");
const emit = (m: string) => (jsonMode ? console.error(m) : console.log(m));

// Filter section (--section wrapper|server): batasi analisa ke satu section
// artifact merged. Temuan tanpa section (laporan Playwright) dan temuan di
// section lain tidak dihitung — verdict/counts/exit code ikut scoped.
// Nilai tidak valid → exit 2 (sebelum main; JSON consumer tetap dapat
// payload error di stdout? Tidak — error ditulis ke stderr, stdout kosong).
const sectionFlag: "wrapper" | "server" | null = (() => {
  const i = process.argv.indexOf("--section");
  if (i === -1) return null;
  const v = process.argv[i + 1];
  if (v !== "wrapper" && v !== "server") {
    console.error(
      `[e2e:triage] --section harus 'wrapper' atau 'server' (dapat: ${String(v)}).`
    );
    process.exit(2);
  }
  return v;
})();

// Baris request server: `GET /api/x 200 in 138ms` / `DELETE /api/x 200 in 5.3s`.
const REQ_RE =
  /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) (\S+) (\d{3}) in ([\d.]+)(ms|s)/;

const DNS_RE =
  /(ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|UND_ERR_CONNECT_TIMEOUT|SELF_SIGNED_CERT|UNABLE_TO_VERIFY)/i;

const TIMEOUT_RE =
  /(Timed out waiting for|timeout of \d+ ?ms exceeded|Test timeout of \d+ ?ms exceeded|waiting for (locator|selector)|TimeoutError|to be (visible|hidden|attached|enabled))/i;

const TEST_ERR_RE = /^(Error|AssertionError|TypeError|ReferenceError):/m;

interface Finding {
  source: string;
  line?: number;
  text: string;
  /** Section artifact asal baris: "wrapper" (log wrapper [e2e]) atau "server". */
  section?: "wrapper" | "server";
}

/**
 * Batas section pada artifact MERGED (server-e2e.log): baris 1..wrapper.end
 * adalah log wrapper (prefix `[e2e] `), lalu separator (satu baris kosong),
 * lalu section server (banner Next + request). Log mentah (dev.log / temp)
 * tidak punya bagian wrapper → wrapper = null, server = seluruh file.
 */
interface SectionBounds {
  wrapper: { start: number; end: number } | null;
  separator: number | null;
  server: { start: number; end: number } | null;
}

/**
 * Ringkasan sukses run (paritas dengan `writeSuccessSummary` wrapper):
 * statistik warm-up ✓/◇/✗ + request per method & non-2xx, dihitung ulang
 * dari artifact merged, plus `runSucceeded` (marker `ringkasan sukses:`
 * yang ditulis wrapper HANYA saat exit 0) sebagai detektor run hijau yang
 * ANDAL — verdict clean bisa saja berasal dari run gagal tanpa pola dikenal.
 */
interface TriageSummary {
  runSucceeded: boolean;
  warmup: { ok: number; synth: number; fail: number; total: number };
  requests: { total: number; non2xx: number; byMethod: Record<string, number> };
  /** Baris per seksi artifact merged — paritas buildArtifactLine wrapper. */
  artifact: { wrapper: number; server: number; stderr: number; total: number };
}

/** Hasil triage terstruktur — dasar output JSON (dan cetak manusia). */
interface TriageResult {
  stalls: Finding[];
  slow: Finding[];
  dns: Finding[];
  timeouts: Finding[];
  errors: Finding[];
  serverLog: string;
  reportFiles: number;
  sections: SectionBounds | null;
  wrapperWarning: string | null;
  summary: TriageSummary | null;
}

/**
 * Mode --json: cetak SATU baris JSON ke stdout (konsumen mesin / bot).
 * Semua temuan disertakan UTUH (tanpa pemotongan 10/5 seperti cetak
 * manusia) — mesin bisa memotong sendiri. `ok` mengikuti exit code:
 * false bila ada stall/dns/timeout/error (slow bersifat info saja) ATAU
 * wrapperWarning (warm-up gagal diam-diam — kategori `warmup-failed`).
 * `verdict` adalah kategori singkat: warmup-failed | cold-compile |
 * network | assertion | clean.
 */
function printJson(r: TriageResult): void {
  const counts = {
    stalls: r.stalls.length,
    slow: r.slow.length,
    dns: r.dns.length,
    timeouts: r.timeouts.length,
    errors: r.errors.length,
  };
  const decisive = counts.stalls + counts.dns + counts.timeouts + counts.errors;
  // Kategori `warmup-failed` MENANG atas counts — wrapperWarning berarti
  // section wrapper terlalu kecil / status jauh di bawah deklarasi (warm-up
  // gagal diam-diam), jadi data pemanasan tidak bisa dipercaya dan stall
  // yang terlihat kemungkinan besar efek sampingnya, bukan akar masalah.
  const verdict = r.wrapperWarning
    ? "warmup-failed"
    : counts.stalls
      ? "cold-compile"
      : counts.dns
        ? "network"
        : decisive
          ? "assertion"
          : "clean";
  const reason =
    verdict === "warmup-failed"
      ? r.wrapperWarning!
      : verdict === "clean"
        ? "tidak ada pola stall/DNS/timeout yang dikenal."
        : counts.stalls > 0
          ? "kemungkinan cold-compile Turbopack (lihat e2e/warmup.ts) — jalankan ulang dengan cache panas."
          : counts.dns > 0
            ? "masalah jaringan/eksternal — cek koneksi & layanan yang dipanggil."
            : "kegagalan assertion — lihat error-context di atas.";
  console.log(
    JSON.stringify({
      tool: "triage:e2e",
      ok: decisive === 0 && !r.wrapperWarning,
      verdict,
      reason,
      counts,
      thresholds: { stallMs: STALL_MS, slowMs: SLOW_MS },
      serverLog: r.serverLog || null,
      reportFiles: r.reportFiles,
      section: sectionFlag,
      sections: r.sections,
      wrapperWarning: r.wrapperWarning,
      summary: r.summary,
      stalls: r.stalls,
      slow: r.slow,
      dns: r.dns,
      timeouts: r.timeouts,
      errors: r.errors,
    })
  );
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Temukan log server e2e: E2E_SERVER_LOG > ./server-e2e.log* > log terbaru
 * di %TEMP% (monsa-e2e-server-<pid>.log). Mengembalikan path utama + `.err`.
 */
async function findServerLog(): Promise<{ main: string; err: string | null }> {
  const candidates = [
    process.env.E2E_SERVER_LOG ?? "",
    "./server-e2e.log",
  ].filter(Boolean);
  for (const c of candidates) {
    if (await exists(c)) {
      const err = await exists(`${c}.err`) ? `${c}.err` : null;
      return { main: c, err };
    }
  }
  // Fallback: log server e2e terbaru di temp (ditulis wrapper saat spawn).
  try {
    const files = (await readdir(tmpdir())).filter((f) =>
      f.startsWith("monsa-e2e-server-") && f.endsWith(".log")
    );
    let best: string | null = null;
    let bestTime = 0;
    for (const f of files) {
      const s = await stat(join(tmpdir(), f));
      if (s.mtimeMs > bestTime) {
        bestTime = s.mtimeMs;
        best = f;
      }
    }
    if (best) {
      const main = join(tmpdir(), best);
      const err = await exists(`${main}.err`) ? `${main}.err` : null;
      return { main, err };
    }
  } catch {
    // temp tidak terbaca — biarkan null.
  }
  return { main: "", err: null };
}

/**
 * Deteksi batas section artifact merged: blok pembuka baris ber-prefix
 * `[e2e] ` = section wrapper, baris kosong setelahnya = separator, sisanya =
 * section server. Log mentah (tanpa baris `[e2e] `) → wrapper null,
 * separator null, server = seluruh file.
 */
function detectSections(lines: string[]): SectionBounds {
  let wrapperEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("[e2e] ")) break;
    wrapperEnd = i + 1;
  }
  if (wrapperEnd === 0) {
    return { wrapper: null, separator: null, server: { start: 1, end: lines.length } };
  }
  let separator: number | null = null;
  let j = wrapperEnd; // 0-based index baris pertama setelah blok wrapper.
  if (j < lines.length && !lines[j].trim()) {
    separator = j + 1; // 1-based — baris kosong pemisah.
  }
  while (j < lines.length && !lines[j].trim()) j++;
  return {
    wrapper: { start: 1, end: wrapperEnd },
    separator,
    server: j < lines.length ? { start: j + 1, end: lines.length } : null,
  };
}

/** Ambang minimum baris non-kosong section wrapper yang dianggap sehat. */
const WRAPPER_MIN_NONEMPTY = 5;

/**
 * Deteksi warm-up yang mungkin GAGAL DIAM-DIAM dari ukuran/isi section
 * wrapper artifact merged: section terlalu kecil (hanya beberapa baris) atau
 * jumlah status rute (✓/◇/✗) jauh di bawah rute yang dideklarasikan di baris
 * "memanaskan N rute". Mengembalikan pesan peringatan atau null (sehat).
 * Log mentah (tanpa section wrapper) → null.
 */
function warnWrapperHealth(lines: string[], sec: SectionBounds): string | null {
  if (!sec.wrapper) return null;
  const wLines = lines
    .slice(sec.wrapper.start - 1, sec.wrapper.end)
    .filter((l) => l.trim());
  if (wLines.length < WRAPPER_MIN_NONEMPTY) {
    return `section wrapper sangat kecil (${wLines.length} baris non-kosong) — warm-up mungkin GAGAL diam-diam.`;
  }
  const declared =
    Number(/memanaskan (\d+) rute/.exec(wLines.join("\n"))?.[1]) || 0;
  const statuses = wLines.filter((l) => /^\[e2e\] [✓◇✗] /.test(l)).length;
  if (declared > 0 && statuses < declared) {
    return `warm-up mencatat hanya ${statuses}/${declared} rute — mungkin gagal sebagian diam-diam.`;
  }
  return null;
}

/**
 * Hitung ringkasan sukses dari baris log artifact merged: glyph warm-up
 * `[e2e] ✓/◇/✗ route -> status` (section wrapper) + baris request server
 * (REQ_RE) — regex & aritmetika SAMA dengan writeSuccessSummary wrapper,
 * jadi angkanya paritas dengan ringkasan artifact CI. `runSucceeded` true
 * bila section wrapper memuat marker `ringkasan sukses:` (ditulis wrapper
 * hanya saat exit 0) — deteksi run hijau yang andal untuk analisa post-hoc.
 */
function computeSummary(lines: string[], sec: SectionBounds): TriageSummary {
  let ok = 0;
  let synth = 0;
  let fail = 0;
  let total = 0;
  let non2xx = 0;
  const byMethod: Record<string, number> = {};
  let runSucceeded = false;
  for (const line of lines) {
    const g = /^\[e2e\] ([✓◇✗]) (\S+) /.exec(line);
    if (g) {
      if (g[1] === "✓") ok += 1;
      else if (g[1] === "◇") synth += 1;
      else fail += 1;
      continue;
    }
    const m = REQ_RE.exec(line.trim());
    if (m) {
      total += 1;
      byMethod[m[1]] = (byMethod[m[1]] ?? 0) + 1;
      if (!m[3].startsWith("2")) non2xx += 1;
      continue;
    }
    if (line.includes("ringkasan sukses:")) runSucceeded = true;
  }
  // Baris per seksi artifact merged — paritas buildArtifactLine wrapper:
  // wrapper = blok pembuka `[e2e] `, server = sisanya setelah separator,
  // total = seluruh file (termasuk separator). stderr diisi pemanggil
  // (artikel .err terpisah) — 0 bila tidak ada file .err.
  const wrapper = sec.wrapper ? sec.wrapper.end - sec.wrapper.start + 1 : 0;
  const server = sec.server ? sec.server.end - sec.server.start + 1 : 0;
  return {
    runSucceeded,
    warmup: { ok, synth, fail, total: ok + synth + fail },
    requests: { total, non2xx, byMethod },
    artifact: { wrapper, server, stderr: 0, total: lines.length },
  };
}

/**
 * Scan log server: stall mutasi, request lambat lain, error DNS. Setiap
 * temuan diberi `section` (wrapper | server) berdasarkan batas section
 * artifact; batasnya + peringatan kesehatan section wrapper dikembalikan
 * untuk dilaporkan.
 */
async function scanServerLog(path: string): Promise<{
  stalls: Finding[];
  slow: Finding[];
  dns: Finding[];
  sections: SectionBounds;
  wrapperWarning: string | null;
  summary: TriageSummary;
}> {
  const stalls: Finding[] = [];
  const slow: Finding[] = [];
  const dns: Finding[] = [];
  const sections: SectionBounds = { wrapper: null, separator: null, server: null };
  if (!path) {
    return {
      stalls,
      slow,
      dns,
      sections,
      wrapperWarning: null,
      summary: {
        runSucceeded: false,
        warmup: { ok: 0, synth: 0, fail: 0, total: 0 },
        requests: { total: 0, non2xx: 0, byMethod: {} },
        artifact: { wrapper: 0, server: 0, stderr: 0, total: 0 },
      },
    };
  }

  const text = await readFile(path, "utf8");
  const lines = text.split("\n");
  const sec = detectSections(lines);
  const wrapperWarning = warnWrapperHealth(lines, sec);
  const summary = computeSummary(lines, sec);
  // Baris stderr dari file .err sibling (artikel terpisah, bukan bagian
  // merged artifact) — paritas `stderr N baris` di buildArtifactLine wrapper.
  try {
    const errPath = `${path}.err`;
    if (await exists(errPath)) {
      const errText = await readFile(errPath, "utf8");
      summary.artifact.stderr = errText.split("\n").length;
    }
  } catch {
    // .err tidak terbaca — biarkan 0.
  }
  const sectionOf = (i: number): "wrapper" | "server" | undefined =>
    sec.wrapper && i + 1 <= sec.wrapper.end ? "wrapper" : "server";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = REQ_RE.exec(line.trim());
    if (m) {
      const [, method, pathPart, , dur, unit] = m;
      const ms = unit === "s" ? Number(dur) * 1000 : Number(dur);
      const fmt = `${method} ${pathPart} in ${dur}${unit}`;
      if (MUTATING.has(method) && ms >= STALL_MS) {
        stalls.push({ source: path, line: i + 1, text: fmt, section: sectionOf(i) });
      } else if (!MUTATING.has(method) && ms >= SLOW_MS) {
        slow.push({ source: path, line: i + 1, text: fmt, section: sectionOf(i) });
      }
    }
    if (DNS_RE.test(line)) {
      dns.push({
        source: path,
        line: i + 1,
        text: line.trim().slice(0, 160),
        section: sectionOf(i),
      });
    }
  }
  // Filter section (--section): temuan di section lain dihapus — berlaku
  // untuk log utama maupun `.err` sibling (keduanya lewat scanServerLog).
  // Log mentah tanpa section wrapper → semua temuan ber-section "server",
  // jadi --section wrapper pada log mentah menghasilkan nol temuan.
  const keep = (f: Finding) => !sectionFlag || f.section === sectionFlag;
  return {
    stalls: stalls.filter(keep),
    slow: slow.filter(keep),
    dns: dns.filter(keep),
    sections: sec,
    wrapperWarning,
    summary,
  };
}

/** Temukan file teks laporan Playwright (error-context, dll) + index.html. */
async function collectReportFiles(): Promise<string[]> {
  const out: string[] = [];
  const roots = [
    process.env.E2E_TEST_RESULTS ?? "./test-results",
    process.env.E2E_PLAYWRIGHT_REPORT ?? "./playwright-report",
  ];
  for (const root of roots) {
    try {
      const entries = await readdir(root, { recursive: true, withFileTypes: true });
      for (const e of entries) {
        if (!e.isFile()) continue;
        const name = e.name.toLowerCase();
        if (
          name.endsWith(".md") ||
          name.endsWith(".txt") ||
          (name === "index.html" && root.includes("playwright-report"))
        ) {
          out.push(join(e.parentPath ?? root, e.name));
        }
      }
    } catch {
      // direktori tidak ada — abaikan.
    }
  }
  return out;
}

/** Scan file laporan: timeout, error DNS, baris error assertion. */
async function scanReportFile(
  path: string
): Promise<{ timeouts: Finding[]; dns: Finding[]; errors: Finding[] }> {
  const timeouts: Finding[] = [];
  const dns: Finding[] = [];
  const errors: Finding[] = [];
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return { timeouts, dns, errors };
  }

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (TIMEOUT_RE.test(line)) {
      timeouts.push({ source: path, line: i + 1, text: line.trim().slice(0, 160) });
    }
    if (DNS_RE.test(line)) {
      dns.push({ source: path, line: i + 1, text: line.trim().slice(0, 160) });
    }
  }
  const em = TEST_ERR_RE.exec(text);
  if (em) {
    errors.push({
      source: path,
      text: em[0].slice(0, 160),
    });
  }
  return { timeouts, dns, errors };
}

async function main(): Promise<number> {
  const log = (m: string) => emit(`[e2e:triage] ${m}`);
  log(
    `Triage kegagalan E2E — stall mutasi >= ${STALL_MS}ms, lambat lain >= ${SLOW_MS}ms.`
  );
  if (sectionFlag) {
    log(
      `Filter section: ${sectionFlag} — hanya temuan di section ini yang dihitung ` +
        `(laporan Playwright tidak punya section, ikut diabaikan).`
    );
  }

  const { main: serverLog, err: serverErr } = await findServerLog();
  if (serverLog) {
    log(`Server log : ${serverLog}`);
  } else {
    log("Server log : tidak ditemukan (fallback %TEMP% kosong).");
  }

  const reportFiles = await collectReportFiles();
  log(
    `Laporan    : ${reportFiles.length} file teks ` +
      `(${process.env.E2E_TEST_RESULTS ?? "./test-results"} + playwright-report)`
  );

  // Kumpulan temuan terstruktur (dipakai output JSON; cetak manusia juga
  // memakai sebagian) + daftar string kategoris untuk verdict & exit code.
  const result: TriageResult = {
    stalls: [],
    slow: [],
    dns: [],
    timeouts: [],
    errors: [],
    serverLog,
    reportFiles: reportFiles.length,
    sections: null,
    wrapperWarning: null,
    summary: null,
  };
  const findings: string[] = [];

  // --- Server log ---
  if (serverLog) {
    const s = await scanServerLog(serverLog);
    result.stalls.push(...s.stalls);
    result.slow.push(...s.slow);
    result.dns.push(...s.dns);
    result.sections = s.sections;
    result.wrapperWarning = s.wrapperWarning;
    // Ringkasan sukses (paritas writeSuccessSummary) — dari log UTAMA saja
    // (file .err hanya stderr, tidak relevan untuk statistik warm-up).
    result.summary = s.summary;
    // Lapor batas section artifact merged (wrapper | separator | server)
    // supaya analis tahu bagian mana yang memuat tiap temuan.
    const sec = s.sections;
    if (sec?.wrapper) {
      log(
        `Section artifact: wrapper L1–${sec.wrapper.end}` +
          (sec.separator ? ` · separator L${sec.separator}` : "") +
          (sec.server ? ` · server L${sec.server.start}–${sec.server.end}` : "")
      );
    } else {
      log("Section artifact: log mentah (tanpa bagian wrapper — bukan artifact merged).");
    }
    if (s.wrapperWarning) {
      log(`⚠️  ${s.wrapperWarning}`);
    }
    if (s.stalls.length) {
      log(`⚠️  ${s.stalls.length} stall mutasi (>= ${STALL_MS / 1000}s) di server log:`);
      for (const f of s.stalls.slice(0, 10)) {
        emit(`   - [${f.section}] L${f.line}: ${f.text}`);
        findings.push(`stall:${f.text}`);
      }
    }
    if (s.slow.length) {
      log(`ℹ️  ${s.slow.length} request lambat lain (>= ${SLOW_MS / 1000}s, info):`);
      for (const f of s.slow.slice(0, 5)) {
        emit(`   - [${f.section}] L${f.line}: ${f.text}`);
      }
    }
    if (s.dns.length) {
      log(`⚠️  ${s.dns.length} error DNS/jaringan di server log:`);
      for (const f of s.dns.slice(0, 5)) {
        emit(`   - [${f.section}] L${f.line}: ${f.text}`);
        findings.push(`dns:${f.text}`);
      }
    }
    if (serverErr) {
      const e = await scanServerLog(serverErr);
      result.dns.push(...e.dns);
      for (const f of e.dns) {
        log(`⚠️  error jaringan di ${serverErr}:`);
        emit(`   - [${f.section}] L${f.line}: ${f.text}`);
        findings.push(`dns:${f.text}`);
      }
    }
  }

  // --- Laporan Playwright ---
  const timeouts: Finding[] = [];
  const reportDns: Finding[] = [];
  const reportErrors: Finding[] = [];
  for (const f of reportFiles) {
    const r = await scanReportFile(f);
    timeouts.push(...r.timeouts);
    reportDns.push(...r.dns);
    reportErrors.push(...r.errors);
    // Filter section aktif: temuan laporan tidak punya section artifact —
    // di luar scope analisa section-scoped, jangan masuk hasil/verdict.
    if (!sectionFlag) {
      result.timeouts.push(...r.timeouts);
      result.dns.push(...r.dns);
      result.errors.push(...r.errors);
    }
  }
  if (sectionFlag) {
    // Cetak manusia (blok di bawah) membaca array lokal — kosongkan agar
    // laporan Playwright tidak dicetak saat analisa di-scope ke satu section.
    timeouts.length = 0;
    reportDns.length = 0;
    reportErrors.length = 0;
  }
  if (timeouts.length) {
    log(`❌ ${timeouts.length} timeout di laporan Playwright:`);
    for (const t of timeouts.slice(0, 10)) {
      emit(`   - ${t.source}:${t.line}: ${t.text}`);
      findings.push(`timeout:${t.text}`);
    }
  }
  if (reportDns.length) {
    log(`⚠️  ${reportDns.length} error DNS/jaringan di laporan Playwright:`);
    for (const d of reportDns.slice(0, 5)) {
      emit(`   - ${d.source}:${d.line}: ${d.text}`);
      findings.push(`dns:${d.text}`);
    }
  }
  if (reportErrors.length) {
    log(`⚠️  ${reportErrors.length} baris error assertion di laporan Playwright:`);
    for (const e of reportErrors.slice(0, 5)) {
      emit(`   - ${e.source}: ${e.text}`);
      findings.push(`error:${e.text}`);
    }
  }

  // --- Ringkasan sukses (paritas dengan wrapper, dihitung ulang dari log) ---
  if (result.summary) {
    const s = result.summary;
    const parts: string[] = [];
    if (s.warmup.total > 0) {
      parts.push(
        `warm-up ${s.warmup.total} rute (✓ ${s.warmup.ok} · ◇ ${s.warmup.synth} · ✗ ${s.warmup.fail})`
      );
    }
    if (s.requests.total > 0) {
      const methods = Object.entries(s.requests.byMethod)
        .sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `${m} ${n}`)
        .join(" · ");
      parts.push(
        `request ${s.requests.total} (${methods}) · non-2xx ${s.requests.non2xx}`
      );
    }
    // Baris per seksi artifact (paritas buildArtifactLine wrapper) — dipakai
    // triage.yml untuk render baris artifact yang SAMA dengan step summary
    // run asli (warm-up + request + artifact tiga bagian seragam).
    const a = s.artifact ?? { wrapper: 0, server: 0, stderr: 0, total: 0 };
    if (a.total > 0) {
      parts.push(
        `artifact: wrapper ${a.wrapper} baris · server ${a.server} baris · stderr ${a.stderr} baris (total ${a.total} baris)`
      );
    }
    if (parts.length) {
      log(
        `ringkasan sukses: ${parts.join(" · ")}` +
          (s.runSucceeded ? "" : " (run TIDAK hijau — konteks saja)")
      );
    }
  }

  // --- Verdict / output akhir ---
  if (jsonMode) {
    printJson(result);
  } else if (result.wrapperWarning) {
    // Kategori `warmup-failed` paritas dengan mode JSON — menang atas temuan
    // counts (data pemanasan tidak bisa dipercaya, stall hanyalah efeknya).
    log(`Verdict: warmup-failed — ${result.wrapperWarning}`);
  } else if (findings.length) {
    const stallN = findings.filter((f) => f.startsWith("stall:")).length;
    const dnsN = findings.filter((f) => f.startsWith("dns:")).length;
    const timeoutN = findings.filter((f) => f.startsWith("timeout:")).length;
    log(
      `Verdict: ${stallN} stall · ${dnsN} dns · ${timeoutN} timeout → ` +
        (stallN
          ? "kemungkinan cold-compile Turbopack (lihat e2e/warmup.ts) — jalankan ulang dengan cache panas."
          : dnsN
            ? "masalah jaringan/eksternal — cek koneksi & layanan yang dipanggil."
            : "kegagalan assertion — lihat error-context di atas.")
    );
  } else {
    log("✅ Tidak ada pola stall/DNS/timeout yang dikenal — kegagalan lain (mis. assertion murni).");
  }
  process.exit(findings.length || result.wrapperWarning ? 1 : 0);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (jsonMode) {
      // Kegagalan tak terduga — tetap beri satu baris JSON yang valid.
      console.log(JSON.stringify({ tool: "triage:e2e", ok: false, error: String(err) }));
      process.exit(2);
    }
    console.error(`[e2e:triage] error: ${String(err)}`);
    process.exit(2);
  });
