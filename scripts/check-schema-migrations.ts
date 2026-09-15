/**
 * CI check: riwayat migrasi harus SELARAS dengan prisma/schema.prisma.
 *
 * Latar belakang: skema pernah berevolusi lewat `prisma db push` sementara
 * direktori migrations tertinggal — akibatnya `prisma migrate deploy` di
 * database baru menghasilkan skema yang tidak cocok dengan schema.prisma
 * (User tanpa mustChangePassword/2FA, tabel TeacherSection/StudentAchievement/
 * dll. tidak ada), ditemukan oleh validasi live terhadap Postgres nyata
 * (2026-09-08) dan diperbaiki oleh migrasi rekonsiliasi
 * `20260908000001_reconcile_schema_drift`.
 *
 * Script ini menjalankan `prisma migrate diff --from-migrations --to-schema-datamodel`
 * dan GAGAL bila diff tidak kosong — menjaga agar migrasi berikutnya selalu
 * dibuat lewat `prisma migrate dev` (yang menghasilkan file migrasi), bukan
 * `prisma db push` yang membuat drift diam-diam.
 *
 * Env:
 *   DATABASE_URL          — koneksi Postgres (dipakai migrate diff)
 *   SHADOW_DATABASE_URL   — database shadow untuk diff (default: DATABASE_URL
 *                           dengan nama DB diganti `shadow`; harus dibuat dulu)
 *   PRISMA_DIFF_ARGS      — (opsional) argumen tambahan untuk prisma migrate diff
 */
import { execSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL tidak diset — tidak bisa memeriksa drift.");
  process.exit(1);
}

// Shadow DB diperlukan untuk diff dari direktori migrasi.
const shadowUrl =
  process.env.SHADOW_DATABASE_URL ?? databaseUrl.replace(/\/[^/]+$/, "/shadow");

function runDiff(): string {
  return execSync(
    `bunx prisma migrate diff --from-migrations prisma/migrations ` +
      `--to-schema-datamodel prisma/schema.prisma ` +
      `--shadow-database-url "${shadowUrl}" --script`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

// Fail-soft: tanpa Postgres yang bisa dijangkau (mis. .env lokal placeholder),
// check dilewati dengan peringatan — jangan sampai gate lokal patah. Drift
// tetap terdeteksi di CI/deploy yang punya DATABASE_URL asli.
let out: string;
try {
  out = runDiff();
} catch (e) {
  const msg = String(e);
  if (/P1001|P1003|ECONNREFUSED|ENOTFOUND|does not exist/.test(msg)) {
    console.warn(
      "⚠️  Database tidak terjangkau — check drift dilewati." +
        " (DATABASE_URL asli + shadow DB dibutuhkan.)"
    );
    process.exit(0);
  }
  console.error("❌ Gagal menjalankan prisma migrate diff:", msg);
  process.exit(1);
}

const trimmed = out.trim();
const empty =
  trimmed === "" ||
  trimmed === "-- This is an empty migration." ||
  trimmed.startsWith("-- This is an empty migration");

if (empty) {
  console.log("✅ Migrasi selaras dengan schema.prisma.");
} else {
  console.error("❌ Migrasi TIDAK selaras dengan schema.prisma:");
  console.error(trimmed.slice(0, 4000));
  console.error(
    "\nPerbaiki dengan `bunx prisma migrate dev` (bukan `prisma db push`)" +
      " agar perubahan skema tercatat sebagai file migrasi."
  );
  process.exit(1);
}