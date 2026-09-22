/**
 * Guard konsistensi error handling (P1-1).
 *
 * Setiap route.ts di src/app/api yang mengekspor handler MUTASI
 * (POST/PUT/PATCH/DELETE) wajib terlindungi: memuat `catch` di dalamnya
 * ATAU memakai `withErrorHandling`. Mencegah regresi setelah batch
 * pembungkusan 2026-09-22 — rute tanpa proteksi menghasilkan 500 tanpa
 * log saat ada lemparan tak tertangkap.
 *
 * Jalankan: bun run check:mutation-handlers (juga bagian dari `check`).
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MUTATION_EXPORT =
  /^export (?:async function (POST|PUT|PATCH|DELETE)\b|const (POST|PUT|PATCH|DELETE) = )/m;

function collectRouteFiles(dir: string, out: string[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) collectRouteFiles(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
}

const files: string[] = [];
collectRouteFiles(join(process.cwd(), "src", "app", "api"), files);

const violations = files.filter((f) => {
  const c = readFileSync(f, "utf8");
  if (!MUTATION_EXPORT.test(c)) return false;
  return !c.includes("catch") && !c.includes("withErrorHandling");
});

if (violations.length > 0) {
  console.error(
    `check:mutation-handlers — ${violations.length} rute mutasi tanpa proteksi error (tambah try/catch atau withErrorHandling):\n`
  );
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`check:mutation-handlers OK — ${files.length} route.ts diperiksa, semua mutasi terlindungi.`);
