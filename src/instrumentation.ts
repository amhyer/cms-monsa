/**
 * Next.js instrumentation hook — dijalankan sekali saat proses server mulai.
 *
 * Dipakai untuk menyalakan scheduler sinkronisasi Dapodik otomatis
 * (lihat src/lib/dapodik-scheduler.ts). Tidak memblokir startup server.
 *
 * Catatan pola (penting): `await import()` WAJIB berada DI DALAM blok
 * `if (process.env.NEXT_RUNTIME === "nodejs")` — bukan sekadar dijaga
 * early-return. Next mengganti `process.env.NEXT_RUNTIME` dengan literal
 * per-runtime saat kompilasi, sehingga bundel EDGE melihat kondisi `false`
 * dan membuang seluruh blok (beserta import-nya). Dengan early-return,
 * statement import tetap berada di body fungsi → webpack (dipakai job e2e
 * lewat `next dev --webpack`) ikut menelusuri graf modul Node-only
 * (node:crypto via dapodik-scheduler → dapodik-sync → encryption) untuk
 * bundel edge dan gagal: "UnhandledSchemeError: Reading from \"node:crypto\"
 * is not handled by plugins" → SEMUA rute 500. Ini pola resmi Next.js
 * (instrumentation per-runtime): https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDapodikScheduler } = await import("@/lib/dapodik-scheduler");
    startDapodikScheduler();
  }
}
