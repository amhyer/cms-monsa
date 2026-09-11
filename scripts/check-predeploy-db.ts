/**
 * Guard pra-deploy: deteksi kondisi P3005 di database produksi SEBELUM
 * `prisma migrate deploy` berjalan.
 *
 * Kondisi P3005: schema database TIDAK kosong (hasil `prisma db push`)
 * tetapi TIDAK punya buku besar `_prisma_migrations`. `migrate deploy`
 * menolak database ini dengan error yang muncul di tengah deploy:
 *
 *   Error: P3005: The database schema is not empty...
 *
 * Guard ini mengotomatiskan Langkah 0 runbook baseline (`prisma migrate
 * status`) dan GAGAL dengan petunjuk jalur yang benar — backup → gerbang
 * paritas → resolve — bukan error Prisma yang samar:
 *
 *   docs/RUNBOOK-BASELINE-NEON.md
 *
 * Catatan perilaku `migrate status`: exit code-nya NON-ZERO saat ada
 * migrasi pending (desain untuk CI) — jadi klasifikasi memakai ISI output,
 * bukan exit code. Status normal yang lolos: ada daftar pending (DB
 * ter-baseline sebagian — aman untuk deploy) ATAU "up to date".
 *
 * Env (konsisten dengan scripts/deploy-vercel.sh):
 *   DATABASE_URL_DIRECT — koneksi direct non-pooler, dipakai bila ada
 *   DATABASE_URL        — fallback koneksi
 */
import { execSync } from "node:child_process";

// `||` bukan `??`: di CI, DATABASE_URL_DIRECT dari secret yang belum diset
// menjadi string kosong (bukan undefined) — harus tetap fallback.
const direct = process.env.DATABASE_URL_DIRECT || undefined;
const databaseUrl = direct ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "❌ DATABASE_URL (atau DATABASE_URL_DIRECT) tidak diset — guard pra-deploy tidak bisa memeriksa database."
  );
  process.exit(1);
}
const target = direct ? "DATABASE_URL_DIRECT" : "DATABASE_URL";

function runStatus(url: string): { code: number; out: string } {
  try {
    const out = execSync("bunx prisma migrate status", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DATABASE_URL: url },
      timeout: 120_000,
    });
    return { code: 0, out: String(out ?? "") };
  } catch (e) {
    const err = e as { status?: number; stdout?: unknown; stderr?: unknown };
    const out = [err.stdout, err.stderr]
      .map((s) => String(s ?? ""))
      .join("\n");
    return { code: err.status ?? 1, out };
  }
}

const { out } = runStatus(databaseUrl);

// Kondisi P3005: schema terisi tanpa buku besar migrasi → deploy PASTI gagal.
if (/P3005|database schema is not empty/i.test(out)) {
  console.error(
    `❌ GUARD PRA-DEPLOY: database produksi (${target}) berisi tabel tetapi TIDAK ` +
      "memiliki buku besar migrasi (_prisma_migrations) — kondisi P3005.\n" +
      "`prisma migrate deploy` akan MENOLAK database ini dengan error:\n" +
      '  "P3005: The database schema is not empty"\n\n' +
      "Jalankan runbook baseline terlebih dahulu SEBELUM deploy:\n" +
      "  docs/RUNBOOK-BASELINE-NEON.md\n" +
      "  (Langkah 1 backup → Langkah 3 gerbang paritas WAJIB → Langkah 5 resolve → Langkah 6-7 verifikasi)\n" +
      "JANGAN menjalankan `prisma migrate resolve` tanpa melewati gerbang paritas Langkah 3 —\n" +
      "resolve tidak memvalidasi apa pun (terverifikasi: berhasil diam-diam di database salah)."
  );
  console.error("\nOutput prisma migrate status (potongan):");
  console.error(out.trim().slice(0, 2000));
  process.exit(1);
}

// Status normal: daftar pending (DB sudah ter-baseline, sebagian/seluruhnya)
// atau "up to date" → deploy boleh jalan.
const pendingMatch = out.match(/have not yet been applied:([\s\S]*)/);
if (pendingMatch || /Database schema is up to date/i.test(out)) {
  console.log(
    `✅ Guard pra-deploy lolos (${target}): database terjangkau dan tidak dalam kondisi P3005.`
  );
  if (pendingMatch) {
    const names = (pendingMatch[1].match(/^\d{14}\S*/gm) ?? []).filter(
      (n) => !n.startsWith("To apply")
    );
    console.log(
      `   migrate deploy akan menerapkan ${names.length} migrasi pending.`
    );
  } else {
    console.log("   Status: Database schema is up to date!");
  }
  process.exit(0);
}

// Bukan P3005, bukan status normal → tidak bisa diverifikasi (koneksi,
// database hilang, dll). Gagalkan sekarang dengan pesan jelas.
console.error(
  `❌ GUARD PRA-DEPLOY: tidak bisa memverifikasi kondisi database produksi (${target}).\n` +
    "Deploy dihentikan — perbaiki koneksi (host direct non-pooler untuk Neon, ?sslmode=require) lalu ulangi."
);
console.error(out.trim().slice(0, 2000));
process.exit(1);
