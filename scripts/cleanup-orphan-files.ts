/**
 * Pemeriksa integritas dokumen BOS — `bun run clean:orphans`.
 *
 * Dokumen BOS disimpan sebagai file PDF (`public/uploads/bos-*.pdf` di disk,
 * atau baris `UploadedFile` bila backend penyimpanan db — lihat
 * src/lib/file-storage.ts) dan direferensikan oleh tabel `BosDocument`
 * (kolom `fileUrl`). Dua arah inkonsistensi bisa muncul:
 *   1. FILE yatim — file `bos-*.pdf` (disk ATAU UploadedFile) TANPA baris DB.
 *      Penyebab: baris dihapus di luar aplikasi (SQL manual, restore/reseed
 *      DB, migrasi), sehingga rute DELETE tidak lagi menemukan fileUrl →
 *      file tertinggal dan tetap terlayani publik (public/ = static atau
 *      route /uploads/[...path]).
 *   2. BARIS gantung — baris `BosDocument` yang file-nya tidak ada di disk
 *      maupun UploadedFile. Penyebab: file dihapus manual, restore parsial,
 *      atau bug rute upload. Baris ini membuat daftar dokumen menampilkan
 *      link yang 404.
 *
 * Perlakuan (aman by design):
 *   - Hanya file ber-prefiks `bos-` (nama file buatan rute upload) — file
 *     lain (gambar galeri/berita, dll.) tidak pernah disentuh.
 *   - FILE yatim: dihapus pada mode default (disk + baris UploadedFile);
 *     dilaporkan pada `--check`.
 *   - BARIS gantung: HANYA dilaporkan, TIDAK PERNAH dihapus (menghapus baris
 *     tanpa persetujuan = kehilangan jejak audit; skrip ini bukan migrasi).
 *     Dilaporkan di KEDUA mode sebagai informasi integritas data.
 *
 * Mode:
 *   - default: hapus file yatim + lapor baris gantung (pembersih manual /
 *     maintenance).
 *   - `--check`: HANYA melapor, TIDAK menghapus apa pun; exit 1 bila jumlah
 *     file yatim melebihi `ORPHAN_EXPECT` (env, default 0) ATAU baris
 *     gantung melebihi `ROWS_WITHOUT_FILE_EXPECT` (env, default 0). Dipakai
 *     CI untuk memastikan suite e2e tidak meninggalkan file BOS di disk/DB
 *     maupun baris tanpa file — "fails on unexpected orphan counts".
 *
 * Pakai DATABASE_URL lingkungan (dev default = db/custom.db).
 */
import { PrismaClient } from "@prisma/client";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const BOS_PREFIX = "bos-";

const CHECK = process.argv.includes("--check");
const EXPECT_ORPHANS = Number(process.env.ORPHAN_EXPECT ?? "0");
const EXPECT_ROWS = Number(process.env.ROWS_WITHOUT_FILE_EXPECT ?? "0");

const db = new PrismaClient();

/** Nama file (basename) dari path /uploads/... */
function basenameOf(url: string): string {
  const base = url.split("/").pop();
  return base ?? url;
}

async function main(): Promise<void> {
  // --- Kumpulkan file BOS dari kedua sumber (disk + UploadedFile) ---
  let diskFiles: string[] = [];
  try {
    diskFiles = (await readdir(UPLOAD_DIR)).filter((f) =>
      f.startsWith(BOS_PREFIX)
    );
  } catch {
    // Direktori uploads belum ada — diperlakukan sebagai nol file disk.
    console.log("Direktori uploads tidak ada — dianggap nol file BOS di disk.");
  }

  // Baris UploadedFile ber-prefiks bos- (backend db / Vercel). Tabel bisa
  // tidak ada di DB dev lama (belum `db push`) — perlakukan sebagai kosong.
  let dbFiles: { filename: string }[] = [];
  try {
    dbFiles = await db.uploadedFile.findMany({
      where: { filename: { startsWith: BOS_PREFIX } },
      select: { filename: true },
    });
  } catch {
    console.log(
      "Tabel UploadedFile tidak ada (skema belum di-migrate/push) — dianggap nol file BOS di DB."
    );
  }

  const dbFileNames = new Set(dbFiles.map((f) => f.filename));
  const allFiles = Array.from(new Set([...diskFiles, ...dbFileNames]));

  const rows = await db.bosDocument.findMany({
    select: { id: true, title: true, fileUrl: true },
  });

  const filesKnown = new Set(allFiles);
  const referenced = new Set(
    rows.map((r) => basenameOf(r.fileUrl)).filter(Boolean)
  );

  // 1) FILE yatim: ada di disk/DB, tidak direferensikan baris mana pun.
  const orphans = allFiles.filter((f) => !referenced.has(f));
  // 2) BARIS gantung: baris DB yang file-nya tidak ada di disk/DB.
  const dangling = rows.filter((r) => !filesKnown.has(basenameOf(r.fileUrl)));

  // --- LAPORAN BARIS GANTUNG (selalu, kedua mode; tidak pernah dihapus) ---
  if (dangling.length > 0) {
    console.log(
      `\nBaris gantung: ${dangling.length} BosDocument tanpa file di disk/DB ` +
        `(TIDAK dihapus — laporan integritas saja):`
    );
    for (const r of dangling) {
      console.log(`  - ${r.id} "${r.title}" → ${r.fileUrl}`);
    }
  } else {
    console.log(
      "\nSemua baris BosDocument punya file di disk/DB — tidak ada baris gantung."
    );
  }

  if (CHECK) {
    // Mode check CI: lapor saja, jangan hapus. Gagal bila file yatim
    // MELEBIHI ORPHAN_EXPECT ATAU baris gantung MELEBIHI
    // ROWS_WITHOUT_FILE_EXPECT (default keduanya 0 — suite e2e harus
    // meninggalkan nol file yatim DAN nol baris tanpa file).
    const orphansExceed = orphans.length > EXPECT_ORPHANS;
    const rowsExceed = dangling.length > EXPECT_ROWS;
    const verdict = orphansExceed || rowsExceed ? "GAGAL" : "OK";
    console.log(
      `ORPHAN_CHECK=orphans=${orphans.length} (expect ${EXPECT_ORPHANS}) ` +
        `rows_without_file=${dangling.length} (expect ${EXPECT_ROWS}) ${verdict}`
    );
    if (orphans.length > 0) {
      console.log(
        `File yatim (dari ${allFiles.length} file BOS) — TIDAK dihapus (mode check):`
      );
      for (const f of orphans) console.log(`  - ${f}`);
    }
    if (orphansExceed || rowsExceed) process.exitCode = 1;
    return;
  }

  if (orphans.length === 0) {
    console.log(
      `Semua ${allFiles.length} file BOS punya baris DB — tidak ada yatim.`
    );
    return;
  }

  for (const f of orphans) {
    if (diskFiles.includes(f)) {
      await unlink(join(UPLOAD_DIR, f));
    }
    if (dbFileNames.has(f)) {
      await db.uploadedFile.deleteMany({ where: { filename: f } });
    }
  }
  console.log(
    `Menghapus ${orphans.length} file yatim (dari ${allFiles.length} file BOS):`
  );
  for (const f of orphans) console.log(`  - ${f}`);
}

main()
  .catch((e) => {
    console.error("Gagal memeriksa integritas dokumen BOS:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
