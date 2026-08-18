/**
 * CI check: mutasi API harus ter-deklarasi di pragma `// warmup:`.
 *
 * Jalankan SETELAH test:e2e (fixture e2e/mutation-log.ts menulis laporan
 * JSONL ke E2E_MUTATION_REPORT, default %TEMP%/monsa-e2e-mutations.jsonl).
 * Script membaca laporan, mencocokkan tiap POST/PUT/DELETE/PATCH ke /api/*
 * dengan pragma di spec yang sama, dan GAGAL bila ada mutasi yang tidak
 * dideklarasikan — menjaga deklarasi tetap jujur di code review.
 *
 * Pragmas bisa path-only (`// warmup: /api/news` — method-agnostik) atau
 * method-spesifik (`// warmup: POST /api/news` — hanya menutupi POST).
 *
 * Env:
 *   E2E_MUTATION_REPORT  path laporan (default sama dengan fixture)
 *   E2E_TEST_DIR         direktori spec (default ./e2e)
 */
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_E2E_TEST_DIR,
  collectSpecWarmupDeclsByFile,
  type WarmupDecl,
} from "../e2e/warmup";

const REPORT_PATH =
  process.env.E2E_MUTATION_REPORT ??
  join(tmpdir(), "monsa-e2e-mutations.jsonl");

// Hanya mutasi yang diperiksa — laporan juga berisi GET (untuk ringkasan
// warm-up wrapper); baris non-mutasi dilewati di sini.
const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * Cocokkan mutasi dengan deklarasi pragma. Path dicocokkan per-segmen;
 * method dicocokkan HANYA bila deklarasi method-spesifik (path-only =
 * method-agnostik, kompatibel dengan pragma lama).
 */
function covers(decl: WarmupDecl, method: string, path: string): boolean {
  if (path !== decl.path && !path.startsWith(`${decl.path}/`)) return false;
  return decl.method === null || decl.method === method;
}

async function main(): Promise<void> {
  const testDir = process.env.E2E_TEST_DIR ?? DEFAULT_E2E_TEST_DIR;
  const declaredByFile = await collectSpecWarmupDeclsByFile(testDir);

  let text: string;
  try {
    text = await readFile(REPORT_PATH, "utf8");
  } catch {
    console.error(
      `❌ Tidak ada laporan mutasi di ${REPORT_PATH} — jalankan test:e2e dulu ` +
        `(fixture e2e/mutation-log.ts menulis laporan saat suite berjalan).`
    );
    process.exit(1);
  }

  const violations = new Set<string>();
  for (const line of text.split("\n").filter((l) => l.trim())) {
    try {
      const entry = JSON.parse(line) as {
        specFile: string;
        method: string;
        path: string;
      };
      if (!MUTATING_METHODS.has(entry.method)) continue; // GET/HEAD bukan mutasi.
      const declared = declaredByFile.get(entry.specFile) ?? [];
      if (!declared.some((d) => covers(d, entry.method, entry.path))) {
        violations.add(
          `${entry.specFile}: ${entry.method} ${entry.path}`
        );
      }
    } catch {
      // baris rusak — abaikan.
    }
  }

  if (violations.size > 0) {
    console.error("❌ Mutasi API tanpa deklarasi pragma // warmup:");
    for (const v of [...violations].sort()) console.error(`   - ${v}`);
    console.error(
      "\nTambah pragma di spec terkait, mis.:\n" +
        "   // warmup: /api/<rute-yang-dimutasi>\n" +
        "Lalu jalankan ulang test:e2e agar laporan ter-regenerasi."
    );
    process.exit(1);
  }

  console.log("✅ Semua mutasi API sudah dideklarasikan di pragma warmup.");
}

void main();
