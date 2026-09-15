/**
 * Lapor pemakaian storage UploadedFile — `bun run storage:usage`.
 *
 * Mencetak hasil `getUploadStorageStats()` dari src/lib/upload-stats.ts
 * (jumlah file, total byte, rincian per mimeType, pemakaian kuota bila
 * NEON_STORAGE_QUOTA_MB diset, dan kandidat cleanup berikutnya — lihat
 * src/lib/upload-cleanup.ts). Logika statistik hidup di lib, bukan di sini.
 *
 * Pakai DATABASE_URL lingkungan (PostgreSQL — dev = branch Neon dev /
 * docker-compose.dev.yml, produksi = Neon main / container postgres).
 *
 * Contoh:
 *   NEON_STORAGE_QUOTA_MB=512 bun run storage:usage
 */
import { db } from "../src/lib/db";
import { getUploadStorageStats } from "../src/lib/upload-stats";
import { uploadRetentionDays } from "../src/lib/upload-cleanup";

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

async function main(): Promise<void> {
  const stats = await getUploadStorageStats();
  const retentionDays = uploadRetentionDays();

  console.log("=".repeat(52));
  console.log("  UploadedFile — pemakaian storage");
  console.log("=".repeat(52));
  console.log(`  File:        ${stats.fileCount}`);
  console.log(`  Total:       ${humanBytes(stats.totalBytes)} (${stats.totalBytes} bytes)`);
  if (stats.quotaBytes !== null) {
    console.log(`  Kuota Neon:  ${humanBytes(stats.quotaBytes)} (NEON_STORAGE_QUOTA_MB)`);
    console.log(`  Pemakaian:   ${stats.usagePercent}%`);
  }
  console.log(
    stats.cleanupCandidates === null
      ? "  Cleanup:     nonaktif (UPLOAD_RETENTION_DAYS <= 0)"
      : `  Cleanup:     ${stats.cleanupCandidates} file kandidat hapus berikutnya (retensi ${retentionDays} hari)`
  );
  if (stats.impact) {
    console.log(
      `  Dampak:      ${stats.impact.referencedCandidates} file masih dipakai konten, ` +
        `${stats.impact.safeCandidates} aman dihapus`
    );
    const byEntity = Object.entries(stats.impact.byEntity)
      .map(([e, n]) => `${e}: ${n}`)
      .join(", ");
    if (byEntity) console.log(`    ${byEntity}`);
  }
  console.log("-".repeat(52));
  if (stats.byMimeType.length === 0) {
    console.log("  (tabel kosong — belum ada upload di backend db)");
  } else {
    console.log("  Per mimeType (terbesar dulu):");
    for (const r of stats.byMimeType) {
      const pct = stats.totalBytes > 0 ? Math.round((r.bytes / stats.totalBytes) * 100) : 0;
      console.log(
        `    ${r.mimeType.padEnd(24)} ${String(r.count).padStart(5)} file  ` +
          `${humanBytes(r.bytes).padStart(9)}  (${pct}%)`
      );
    }
  }
  console.log("=".repeat(52));
}

main()
  .catch((e) => {
    console.error("Gagal membaca statistik upload:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });