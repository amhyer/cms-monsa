// markdownlint-cli2 configuration
// Custom rules (scripts/markdownlint-custom.cjs) menangkap dua bug yang
// tidak dicakup rule core: tautan relatif rusak & fence tak seimbang.
"use strict";

module.exports = {
  // Globs dipindahkan ke sini (bukan argumen CLI) agar skrip lint:md bisa
  // tanpa argumen — bekerja identik di bash (CI) dan cmd.exe (Windows).
  globs: ["**/*.md"],
  // Hanya aktifkan rule struktural yang relevan; rule gaya (line length,
  // heading style, dsb.) dimatikan agar fokus pada bug nyata.
  config: {
    // PENTING: dengan default:false, rule kustom (CUSTOM001/CUSTOM002)
    // juga ikut dimatikan — harus diaktifkan eksplisit di bawah ini.
    default: false,
    // MD042 — link tanpa target ([text]() atau [text](#))
    MD042: true,
    // MD055 — gaya tabel konsisten (pipe di awal/akhir)
    MD055: true,
    // MD056 — jumlah kolom tabel konsisten di semua baris
    MD056: true,
    // CUSTOM001 — tautan relatif harus ada di disk
    CUSTOM001: true,
    // CUSTOM002 — fence (```/~~~) harus seimbang (tidak ada yang tak ditutup)
    CUSTOM002: true,
  },
  // CATATAN: tiap file custom rule harus meng-export SATU rule object
  // (bukan array) agar dimuat dengan benar oleh markdownlint-cli2.
  customRules: [
    "./scripts/markdownlint/relative-link.cjs",
    "./scripts/markdownlint/balanced-fences.cjs",
  ],
  ignores: [
    "node_modules",
    ".git",
    "coverage",
    "test-results",
    "playwright-report",
    ".next",
  ],
};
