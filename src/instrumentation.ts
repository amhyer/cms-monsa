/**
 * Next.js instrumentation hook — dijalankan sekali saat proses server mulai.
 *
 * Dipakai untuk menyalakan scheduler sinkronisasi Dapodik otomatis
 * (lihat src/lib/dapodik-scheduler.ts). Tidak memblokir startup server.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startDapodikScheduler } = await import("@/lib/dapodik-scheduler");
  startDapodikScheduler();
}
