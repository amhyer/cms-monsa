/**
 * Dev-only write guard untuk database remote.
 *
 * Latar belakang: file .env.local hasil `vercel env pull` menunjuk langsung
 * ke Neon produksi, sehingga `npm run dev` bisa menulis ke database produksi
 * (klik salah satu tombol admin di preview = mutasi data nyata). Guard ini
 * membuat hal itu tidak mungkin terjadi secara diam-diam.
 *
 * Perilaku:
 *  - Aktif HANYA saat NODE_ENV !== "production" (produksi Vercel/self-host
 *    tidak pernah terpengaruh) dan DATABASE_URL menunjuk host database
 *    remote yang dikenal (Neon, RDS, Supabase, dll).
 *  - Saat aktif, SEMUA operasi tulis Prisma (create/update/delete/upsert/
 *    executeRaw) melempar error dengan pesan jelas + cara keluar:
 *    set ALLOW_REMOTE_DB_WRITES=1 (mis. untuk seed Neon branch dev).
 *  - Operasi baca tetap boleh, sehingga dev terhadap snapshot remote masih
 *    bisa melihat data.
 *
 * Cara keluar yang disengaja (opt-in eksplisit per proses):
 *   ALLOW_REMOTE_DB_WRITES=1 npm run dev
 */

/** Hostname domain database-managed yang dianggap "remote/produksi". */
const REMOTE_DB_HOST_RE =
  /(\.|^)(neon\.tech|amazonaws\.com|aws\.neon\.tech|supabase\.co|supabase\.com|render\.com|planetscale\.com|cockroachlabs\.cloud|azure\.com|timescale\.com|vercel-storage\.com|aivencloud\.com|db\.osp\.digitalocean\.com)$/i;

function hostnameOf(databaseUrl: string | undefined): string {
  if (!databaseUrl) return "";
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "";
  }
}

/** True bila URL menunjuk host database remote yang dikenal. */
export function isRemoteDatabaseHost(databaseUrl: string | undefined): boolean {
  const host = hostnameOf(databaseUrl);
  if (!host) return false;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "host.docker.internal"
  ) {
    return false;
  }
  return REMOTE_DB_HOST_RE.test(host);
}

/** True bila guard harus dipasang pada proses ini. */
export function isWriteGuardActive(env: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  ALLOW_REMOTE_DB_WRITES?: string;
} = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.ALLOW_REMOTE_DB_WRITES === "1") return false;
  return isRemoteDatabaseHost(env.DATABASE_URL);
}

/** Aksi Prisma yang mengubah data — semuanya diblokir saat guard aktif. */
export const GUARDED_WRITE_ACTIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "executeRaw",
]);

export function isGuardedWriteAction(action: string): boolean {
  return GUARDED_WRITE_ACTIONS.has(action);
}

export function writeGuardErrorMessage(action: string): string {
  return (
    `[db-write-guard] Operasi tulis "${action}" ke database remote diblokir ` +
    `di development (DATABASE_URL menunjuk host remote — kemungkinan produksi). ` +
    `Pakai database lokal (docker compose -f docker-compose.dev.yml up -d), ` +
    `atau set ALLOW_REMOTE_DB_WRITES=1 untuk mengizinkan tulis remote secara eksplisit.`
  );
}

/** Deskripsi status guard untuk log startup. */
export function describeWriteGuard(env: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  ALLOW_REMOTE_DB_WRITES?: string;
} = process.env): string {
  if (env.NODE_ENV === "production") return "db-write-guard: nonaktif (produksi)";
  if (env.ALLOW_REMOTE_DB_WRITES === "1")
    return "db-write-guard: nonaktif (ALLOW_REMOTE_DB_WRITES=1 — tulis remote diizinkan)";
  if (isRemoteDatabaseHost(env.DATABASE_URL))
    return "db-write-guard: AKTIF (database remote — tulis diblokir, baca diizinkan)";
  return "db-write-guard: nonaktif (database lokal)";
}
