/**
 * test:e2e:local — jalankan wrapper E2E untuk dev server lokal dengan
 * E2E_SERVER_LOG otomatis menunjuk ke .zscripts/dev.log (log yang ditulis
 * .zscripts/dev.sh). Dipakai untuk run terhadap server yang sedang hidup
 * (reuse mode: --if-up / pidfile) supaya tail kegagalan reuse mode langsung
 * lengkap tanpa perlu menyetel env secara manual.
 *
 * Bukan sekadar alias shell karena: (1) sintaks env inline tidak
 * cross-platform (cmd.exe vs bash), dan (2) run-e2e.ts membaca E2E_SERVER_LOG
 * saat MODULE LOAD, jadi nilai harus diset SEBELUM import — launcher ini
 * menjamin urutan itu. E2E_SERVER_LOG yang sudah diset eksplisit TETAP
 * dihormati (tidak ditimpa).
 */
import { join } from "node:path";

if (!process.env.E2E_SERVER_LOG) {
  process.env.E2E_SERVER_LOG = join(process.cwd(), ".zscripts", "dev.log");
  console.log(
    `[e2e:local] E2E_SERVER_LOG otomatis -> ${process.env.E2E_SERVER_LOG}`
  );
}

// run-e2e.ts mengeksekusi main() dan memanggil process.exit() sendiri saat
// di-import — launcher cukup meneruskan. Import DINAMIS: pastikan env di atas
// sudah diset sebelum module load (lihat komentar header).
import("./run-e2e");
