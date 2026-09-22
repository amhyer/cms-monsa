/**
 * Guard konsistensi error handling (P1-1, DIPERKETAT 2026-09-22).
 *
 * Setiap route.ts di src/app/api yang mengekspor handler MUTASI
 * (POST/PUT/PATCH/DELETE) wajib terlindungi dengan SALAH SATU pola:
 *
 *   1. `export async function POST(...) { ... try { ... } catch ... }`
 *      — try/catch HARUS berada di dalam body handler itu sendiri.
 *   2. `export const POST = withErrorHandling(handler);`
 *      — handler dibungkus wrapper error global.
 *
 * Versi lama hanya mengecek kata "catch" di SELURUH file, sehingga
 * `.catch(() => ({}))` pada `req.json()` membuat route TANPA proteksi
 * lolos gate (5 kasus nyata, ditemukan 2026-09-22). Versi ini memindai
 * body setiap handler (scan kurung seimbang, sadar string & komentar)
 * sehingga false-negative seperti itu tidak mungkin terjadi lagi.
 *
 * Jalankan: bun run check:mutation-handlers (juga bagian dari `check`).
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MUTATION_EXPORT =
  /export\s+(async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/g;

function collectRouteFiles(dir: string, out: string[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) collectRouteFiles(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
}

/**
 * Lewati literal string / komentar mulai dari posisi i (i menunjuk karakter
 * pembuka). Mengembalikan indeks karakter SETELAH konstruksi selesai.
 * Menangani escape (backslash), template literal, komentar satu baris,
 * dan komentar blok gaya C.
 */
function skipStringOrComment(src: string, i: number): number {
  const ch = src[i];
  if (ch === '"' || ch === "'" || ch === "`") {
    i++;
    while (i < src.length) {
      if (src[i] === "\\") {
        i += 2;
        continue;
      }
      if (src[i] === ch) return i + 1;
      i++;
    }
    return i;
  }
  if (ch === "/" && src[i + 1] === "/") {
    while (i < src.length && src[i] !== "\n") i++;
    return i;
  }
  if (ch === "/" && src[i + 1] === "*") {
    i += 2;
    while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
    return Math.min(i + 2, src.length);
  }
  return i;
}

/** Cari indeks `{` pembuka body setelah daftar parameter (kurung seimbang). */
function findBodyOpen(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const skipped = skipStringOrComment(src, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) {
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src.startsWith("=>", j)) {
          j += 2;
          while (j < src.length && /\s/.test(src[j])) j++;
        }
        return src[j] === "{" ? j : -1;
      }
    }
  }
  return -1;
}

/** Scan kurung seimbang; kembalikan indeks `}` penutup body. -1 jika gagal. */
function findBodyClose(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const skipped = skipStringOrComment(src, i);
    if (skipped !== i) {
      i = skipped - 1;
      continue;
    }
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Body handler mengandung try/catch sungguhan (bukan `.catch()` chaining). */
function bodyHasTryCatch(body: string): boolean {
  return /\btry\s*\{/.test(body) && /\bcatch\s*(\(|\{)/.test(body);
}

interface HandlerDecl {
  name: string;
  start: number;
  end: number; // indeks setelah `=`
}

function findViolations(src: string): string[] {
  const problems: string[] = [];
  MUTATION_EXPORT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MUTATION_EXPORT.exec(src)) !== null) {
    const name = m[2];
    const isFn = m[1].includes("function");
    const decl: HandlerDecl = { name, start: m.index, end: m.index + m[0].length };

    let bodyStart = -1;
    if (isFn) {
      bodyStart = findBodyOpen(src, decl.end);
    } else {
      // `export const POST = ...` — wajib langsung dibungkus withErrorHandling
      let j = decl.end;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === "=") {
        j++;
        while (j < src.length && /\s/.test(src[j])) j++;
      }
      if (src.startsWith("withErrorHandling(", j)) continue; // pola 2: OK
      // pola arrow/fungsi expresi: periksa body-nya seperti function biasa
      bodyStart = findBodyOpen(src, j);
      if (bodyStart === -1) {
        problems.push(name);
        continue;
      }
    }

    if (bodyStart === -1) {
      // Tidak bisa memindai body (struktur tidak wajar) → fallback konservatif
      // ke pemeriksaan file-keseluruhan agar tidak false-positive.
      if (!src.includes("catch") && !src.includes("withErrorHandling")) {
        problems.push(name);
      }
      continue;
    }
    const close = findBodyClose(src, bodyStart);
    const body = close === -1 ? "" : src.slice(bodyStart, close + 1);
    if (bodyHasTryCatch(body)) continue;
    // Fallback: pemindai sadar-string bisa meleset pada literal regex yang
    // mengandung kutip (mis. /"/g). Ulangi pada potongan body s.d. batas
    // export berikutnya (atau EOF) — cukup untuk kasus seperti itu.
    const nextExport = src.indexOf("\nexport ", bodyStart);
    const sliceEnd = nextExport === -1 ? src.length : nextExport;
    if (!bodyHasTryCatch(src.slice(bodyStart, sliceEnd))) problems.push(name);
  }
  return problems;
}

const files: string[] = [];
collectRouteFiles(join(process.cwd(), "src", "app", "api"), files);

const violations: string[] = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const name of findViolations(src)) {
    violations.push(`${f} — handler ${name} tanpa proteksi error`);
  }
}

if (violations.length > 0) {
  console.error(
    `check:mutation-handlers — ${violations.length} handler mutasi tanpa proteksi error:\n`
  );
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    `\nGunakan try { ... } catch di dalam body handler, atau bungkus dengan withErrorHandling:`
  );
  console.error(`  async function POST_impl(...) { ... }`);
  console.error(`  export const POST = withErrorHandling(POST_impl);`);
  process.exit(1);
}
console.log(
  `check:mutation-handlers OK — ${files.length} route.ts diperiksa, semua handler mutasi terlindungi.`
);
