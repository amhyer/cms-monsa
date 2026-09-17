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
 *   ALLOW_REMOTE_DB_WRITES=1 npm run dev            ← semua host diizinkan
 *   DEV_DB_SAFE_HOSTS=ep-dev.xxx.aws.neon.tech npm run dev
 *                                                    ← hanya host tsb
 *
 * DEV_DB_SAFE_HOSTS adalah allow-list host yang dianggap aman untuk tulis
 * di development (mis. Neon branch khusus dev). Semantik tiap entri:
 *   - "ep-dev.xxx.aws.neon.tech" → cocok PERSIS hostname itu saja.
 *   - ".aws.neon.tech" (awalan titik) → cocok SEMUA subdomain domain itu
 *     (gaya cookie-domain), tapi BUKAN domain telanjangnya.
 * Guard tetap terpasang untuk host remote lain yang tidak terdaftar —
 * berbeda dari ALLOW_REMOTE_DB_WRITES=1 yang mematikan guard sepenuhnya.
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

/**
 * Parse isi DEV_DB_SAFE_HOSTS: dipisah koma, lowercase, buang entri kosong
 * dan titik tertinggal. Entri berawalan titik = suffix-match domain.
 */
export function parseSafeHosts(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/\.+$/, ""))
    .filter((s) => s.length > 0);
}

/**
 * True bila `host` terdaftar di allow-list: cocok persis, atau (untuk entri
 * berawalan titik) berakhiran `.entry`.
 */
export function isHostAllowListed(host: string, allowList: string[]): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return allowList.some((entry) =>
    entry.startsWith(".") ? h.endsWith(entry) : h === entry
  );
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
  DEV_DB_SAFE_HOSTS?: string;
} = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.ALLOW_REMOTE_DB_WRITES === "1") return false;
  const host = hostnameOf(env.DATABASE_URL);
  if (!isRemoteDatabaseHost(env.DATABASE_URL)) return false;
  // Host yang terdaftar eksplisit di allow-list boleh ditulis — guard tetap
  // aktif untuk host remote lain.
  if (isHostAllowListed(host, parseSafeHosts(env.DEV_DB_SAFE_HOSTS)))
    return false;
  return true;
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
    `daftarkan host dev di DEV_DB_SAFE_HOSTS (mis. Neon branch), atau set ` +
    `ALLOW_REMOTE_DB_WRITES=1 untuk mengizinkan tulis remote secara eksplisit.`
  );
}

/** Deskripsi status guard untuk log startup. */
export function describeWriteGuard(env: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  ALLOW_REMOTE_DB_WRITES?: string;
  DEV_DB_SAFE_HOSTS?: string;
} = process.env): string {
  if (env.NODE_ENV === "production") return "db-write-guard: nonaktif (produksi)";
  if (env.ALLOW_REMOTE_DB_WRITES === "1")
    return "db-write-guard: nonaktif (ALLOW_REMOTE_DB_WRITES=1 — tulis remote diizinkan)";
  if (isRemoteDatabaseHost(env.DATABASE_URL)) {
    const host = hostnameOf(env.DATABASE_URL);
    if (isHostAllowListed(host, parseSafeHosts(env.DEV_DB_SAFE_HOSTS)))
      return `db-write-guard: nonaktif untuk ${host} (terdaftar di DEV_DB_SAFE_HOSTS — tulis diizinkan)`;
    return "db-write-guard: AKTIF (database remote — tulis diblokir, baca diizinkan)";
  }
  return "db-write-guard: nonaktif (database lokal)";
}
