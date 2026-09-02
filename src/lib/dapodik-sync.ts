import { db } from "@/lib/db";
import { DapodikClient, type DapodikConfig as DapodikClientConfig } from "@/lib/dapodik-client";
import { ensureBridgeColumns } from "@/lib/dapodik-bridge";

// ---- Types (dikonfirmasi dari response Dapodik asli) ----

export type DapodikSiswa = {
  peserta_didik_id: string;
  nipd?: string; // NIS lokal sekolah — dipakai untuk Student.nis
  nisn?: string; // NIS Nasional — dipakai untuk Student.nisn
  nama: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
  alamat_jalan?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  nama_rombel?: string;
  rombongan_belajar_id?: string; // kunci matching ke Class.dapodikId
};

export type DapodikGTK = {
  nama: string;
  nuptk?: string;
  nip?: string;
  nik?: string;
  jenis_kelamin?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  agama_id_str?: string;
  status_kepegawaian_id_str?: string;
  jenis_ptk_id_str?: string;
  pangkat_golongan_terakhir?: string;
  pendidikan_terakhir?: string;
  bidang_studi_terakhir?: string;
  jabatan_ptk_id_str?: string; // "Kepala Sekolah" | "Guru Kelas" | "Guru Mapel" | "TAS" ...
};

export type DapodikRombel = {
  rombongan_belajar_id: string; // disimpan sebagai Class.dapodikId
  nama: string;
  tingkat_pendidikan_id_str?: string;
  ptk_id_str?: string; // nama wali kelas
};

export type DapodikSekolah = {
  nama: string;
  npsn: string;
  alamat?: string;
  alamat_jalan?: string;
};

export type SyncResult = {
  sekolah: { updated: number };
  siswa: { created: number; updated: number; archived: number; errors: number };
  gtk: { created: number; updated: number; archived: number; errors: number };
  rombel: { created: number; updated: number; errors: number };
};

export type DryRunResult = SyncResult & { mode: "dry-run" };
export type CommitResult = SyncResult & { mode: "commit"; logId: string };

export type DapodikPayload = {
  sekolah: DapodikSekolah;
  siswa: DapodikSiswa[];
  gtk: DapodikGTK[];
  rombel: DapodikRombel[];
};

const MAX_INGEST_ROWS = 5000;

function asList<T>(raw: unknown): T[] {
  if (raw == null) return [];
  return (Array.isArray(raw) ? raw : [raw]) as T[];
}

/** Normalisasi body ingest / hasil tarikan Dapodik menjadi payload sync. */
export function normalizeDapodikPayload(raw: unknown): DapodikPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Payload Dapodik tidak valid.");
  }
  const o = raw as Record<string, unknown>;
  const sekolahRaw = o.sekolah;
  if (!sekolahRaw || typeof sekolahRaw !== "object" || Array.isArray(sekolahRaw)) {
    throw new Error("Field sekolah wajib berupa objek.");
  }
  const sekolah = sekolahRaw as DapodikSekolah;
  if (!normalize(sekolah.nama) || !normalize(sekolah.npsn)) {
    throw new Error("Field sekolah.nama dan sekolah.npsn wajib diisi.");
  }
  const siswa = asList<DapodikSiswa>(o.siswa ?? o.peserta_didik);
  const gtk = asList<DapodikGTK>(o.gtk);
  const rombel = asList<DapodikRombel>(o.rombel);
  if (
    siswa.length > MAX_INGEST_ROWS ||
    gtk.length > MAX_INGEST_ROWS ||
    rombel.length > MAX_INGEST_ROWS
  ) {
    throw new Error(`Terlalu banyak baris (maksimal ${MAX_INGEST_ROWS} per jenis data).`);
  }
  return { sekolah, siswa, gtk, rombel };
}

// ---- Helpers ----

export function mapGender(jk?: string): string | null {
  if (!jk) return null;
  const lower = jk.toLowerCase().trim();
  if (lower === "l" || lower.includes("laki")) return "LAKI_LAKI";
  if (lower === "p" || lower.includes("perempuan")) return "PEREMPUAN";
  return null;
}

export function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

// Beberapa nilai dari Dapodik (nisn, nipd) bisa berupa string spasi
// kosong untuk siswa baru yang belum lengkap datanya. String spasi itu
// "truthy" di JS, jadi harus dinormalisasi dulu sebelum dipakai.
export function normalize(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Alamat sekolah dari Dapodik WS: utamakan `alamat_jalan`, fallback `alamat`. */
export function resolveSchoolAddress(sekolah: {
  alamat?: string | null;
  alamat_jalan?: string | null;
}): string | null {
  return normalize(sekolah.alamat_jalan) || normalize(sekolah.alamat);
}

export function combineParentName(ayah?: string, ibu?: string): string | null {
  const parts = [ayah, ibu]
    .map((v) => (v ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(" / ") : null;
}

// Ekstrak angka kelas dari nama rombel ("1.a" → 1, "III.b" → 3, "VI.a" → 6).
// Dipakai oleh resolveNis untuk membuat fallback NIS numerik.
const ROMBEL_GRADE_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9,
};
export function parseGradeFromRombel(namaRombel?: string): number | null {
  if (!namaRombel) return null;
  const m = namaRombel.match(/^(\d+|[IVX]+)\./i);
  if (!m) return null;
  const token = m[1];
  // Angka Arab: "1.a" → 1
  const asNum = Number(token);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
  // Angka Romawi: "III.b" → 3
  const upper = token.toUpperCase();
  return ROMBEL_GRADE_MAP[upper] ?? null;
}

// nis wajib unik & tidak boleh kosong. Utamakan nipd (NIS lokal); kalau
// tidak ada, generate NIS numerik berbasis kelas/angkatan (bukan UUID)
// supaya sinkronisasi Dapodik berikutnya tidak menimbulkan UUID baru.
//
// Pola fallback: {YY_angkatan}{YY+1}{0715}{hash3} — 10 digit, deterministik
// berdasarkan nama_rombel + nama siswa sehingga konsisten antar sync.
export function resolveNis(
  s: DapodikSiswa,
  namaRombel?: string,
): string {
  const nipd = normalize(s.nipd);
  if (nipd) return nipd;

  // Fallback: NIS numerik berbasis kelas/angkatan
  const grade = parseGradeFromRombel(namaRombel ?? s.nama_rombel);
  const seed = `${s.peserta_didik_id}|${s.nama ?? ""}`;
  if (grade) {
    const now = new Date();
    // Angkatan = tahun saat ini − (kelas − 1)
    // Kelas 1 thn 2026 → angkatan 2026 → 2627
    // Kelas 3 thn 2026 → angkatan 2024 → 2425
    const angkatan = now.getFullYear() - (grade - 1);
    const yy = angkatan % 100;
    const yyNext = (yy + 1) % 100;
    // 4 digit deterministik dari peserta_didik_id + nama (0001–9999)
    // supaya dua siswa senama di kelas yang sama tidak tabrakan.
    const hash = Array.from(seed).reduce(
      (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
      0,
    );
    const seq = (Math.abs(hash) % 9999) + 1;
    return `${String(yy).padStart(2, "0")}${String(yyNext).padStart(2, "0")}07${String(seq).padStart(4, "0")}`;
  }

  // Terakhir: hash deterministik dari id+nama (bukan UUID)
  // Guard: bila nama kosong, pakai peserta_didik_id sebagai fallback mutlak
  if (!s.nama) return s.peserta_didik_id;
  const hash = Array.from(seed).reduce(
    (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
    0,
  );
  return String(Math.abs(hash)).padStart(10, "0").slice(-10);
}

// ---- Get Dapodik Client from DB config ----

export async function getDapodikClient(): Promise<DapodikClient> {
  const config = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!config) {
    throw new Error("Konfigurasi Dapodik belum diatur. Silakan simpan konfigurasi terlebih dahulu.");
  }
  const clientConfig: DapodikClientConfig = {
    npsn: config.npsn,
    token: config.token,
    host: config.host,
    port: config.port,
    protocol: config.protocol as "http" | "https",
    // Dapodik Web Service lokal hampir selalu HTTP; di production flag ini
    // harus diaktifkan operator lewat UI agar guard HTTPS-only tidak memblokir
    // koneksi ke server Dapodik di jaringan lokal/VPN yang sudah aman.
    allowInsecureInProduction: config.allowInsecureInProduction,
  };
  return new DapodikClient(clientConfig);
}

// ---- Save Config ----

export async function saveDapodikConfig(data: {
  npsn: string;
  token?: string;
  host: string;
  port: number;
  protocol: string;
  archiveUnlisted?: boolean;
  allowInsecureInProduction?: boolean;
}) {
  const existing = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  const token = normalize(data.token) || existing?.token || null;
  if (!token) {
    throw new Error("Token Dapodik wajib diisi pada konfigurasi pertama.");
  }
  const payload = {
    npsn: data.npsn,
    token,
    host: data.host,
    port: data.port,
    protocol: data.protocol,
    ...(typeof data.archiveUnlisted === "boolean" ? { archiveUnlisted: data.archiveUnlisted } : {}),
    ...(typeof data.allowInsecureInProduction === "boolean"
      ? { allowInsecureInProduction: data.allowInsecureInProduction }
      : {}),
  };
  return db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...payload },
    update: payload,
  });
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/**
 * Baca DapodikConfig dengan self-heal untuk kolom kunci pairing.
 * Bila migrasi Neon belum jalan, field bridgeTokenHash/bridgeTokenPrefix/
 * bridgeTokenCreatedAt belum ada di tabel → Prisma melempar P2022. Runtime
 * menambahkan kolom lewat ensureBridgeColumns lalu mengulang baca sekali,
 * agar dashboard tidak error saat kolom belum dimigrasi.
 */
async function readConfigWithBridgeHeal() {
  try {
    return await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2022") throw err;
    await ensureBridgeColumns();
    return await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  }
}

export async function getDapodikConfig() {
  const config = await readConfigWithBridgeHeal();
  if (!config) return null;
  const token = config.token ?? "";
  return {
    id: config.id,
    npsn: config.npsn,
    host: config.host,
    port: config.port,
    protocol: config.protocol,
    allowInsecureInProduction: config.allowInsecureInProduction,
    autoSyncEnabled: config.autoSyncEnabled,
    autoSyncIntervalHours: config.autoSyncIntervalHours,
    autoSyncLastRunAt: config.autoSyncLastRunAt,
    autoSyncLastStatus: config.autoSyncLastStatus,
    autoSyncLastError: config.autoSyncLastError,
    lastSyncAt: config.lastSyncAt,
    lastSyncBy: config.lastSyncBy,
    archiveUnlisted: config.archiveUnlisted,
    updatedAt: config.updatedAt,
    token: maskSecret(token),
    hasToken: token.length > 0,
    hasBridgeToken: Boolean(config.bridgeTokenHash),
    bridgeTokenPrefix: config.bridgeTokenPrefix ?? null,
    bridgeTokenCreatedAt: config.bridgeTokenCreatedAt ?? null,
  };
}

// ---- Test Connection ----

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const client = await getDapodikClient();
    const sekolah = await client.getSekolah();
    return {
      success: true,
      message: `Tersambung ke Dapodik — ${sekolah.nama} (NPSN: ${sekolah.npsn})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menghubungi Dapodik";
    return { success: false, message: msg };
  }
}

// ---- Main Sync Function ----

export async function runSync(
  mode: "dry-run" | "commit",
  opts?: { userId?: string }
): Promise<DryRunResult | CommitResult> {
  const client = await getDapodikClient();

  // Ditarik berurutan (bukan Promise.all): server Dapodik lokal sering gagal
  // bila menerima beberapa request database sekaligus — sama seperti perilaku
  // tombol "Tarik Data" di dashboard yang berjalan step-by-step.
  let sekolah: DapodikSekolah;
  let siswaRaw: unknown;
  let gtkRaw: unknown;
  let rombelRaw: unknown;
  try {
    sekolah = (await client.getSekolah()) as DapodikSekolah;
    siswaRaw = await client.getPesertaDidik();
    gtkRaw = await client.getGTK();
    rombelRaw = await client.getRombonganBelajar();
  } catch (err) {
    const cause = err instanceof Error ? err.message : "respons tidak dikenal";
    throw new Error(
      `Tarik data dari server Dapodik gagal: ${cause}. ` +
        `Pastikan aplikasi Dapodik terbuka dan database-nya terhubung (bukan "Tidak terhubung dengan database"), lalu coba lagi.`
    );
  }

  return applyDapodikPayload(
    normalizeDapodikPayload({
      sekolah,
      peserta_didik: siswaRaw,
      gtk: gtkRaw,
      rombel: rombelRaw,
    }),
    mode,
    opts
  );
}

export async function applyDapodikPayload(
  payload: DapodikPayload,
  mode: "dry-run" | "commit",
  opts?: { userId?: string }
): Promise<DryRunResult | CommitResult> {
  const { sekolah, siswa: siswaList, gtk: gtkList, rombel: rombelList } = payload;

  // Existing DB state
  const existingStudents = await db.student.findMany({
    select: { id: true, nis: true, nisn: true, dapodikId: true },
  });
  const existingByNis = new Map(existingStudents.map((s) => [s.nis, { id: s.id }]));
  const existingByDapodikId = new Map(
    existingStudents.filter((s) => s.dapodikId).map((s) => [s.dapodikId!, { id: s.id }])
  );
  // Map nis & dapodikId bisa menunjuk ke siswa yang SAMA (nis lama + dapodikId).
  // Setiap id tetap dihitung sekali lewat allExistingIds.
  const allExistingIds = new Set(existingStudents.map((s) => s.id));

  // Bila false, siswa/guru yang tidak ada di Dapodik TIDAK dinonaktifkan.
  const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  const archiveUnlisted = cfg?.archiveUnlisted !== false;

  const existingTeachers = await db.teacher.findMany({
    select: { id: true, nuptk: true, nip: true },
  });
  const teacherByNuptk = new Map(
    existingTeachers.filter((t) => t.nuptk).map((t) => [t.nuptk!, { id: t.id }])
  );
  const teacherByNip = new Map(
    existingTeachers.filter((t) => t.nip).map((t) => [t.nip!, { id: t.id }])
  );
  const existingTeacherIds = new Set(existingTeachers.map((t) => t.id));

  const existingClasses = await db.class.findMany({
    select: { id: true, name: true, dapodikId: true },
  });
  const classByDapodikId = new Map(
    existingClasses.filter((c) => c.dapodikId).map((c) => [c.dapodikId as string, c.id])
  );
  const classByName = new Map(existingClasses.map((c) => [c.name, c.id]));

  const academicYear = currentAcademicYear();

  // ---- Dry-run simulation ----
  // Setelah commit, SEMUA rombel di rombelList pasti akan punya Class
  // (dibuat atau diupdate). Jadi untuk simulasi dry-run, anggap semua
  // rombongan_belajar_id di rombelList "akan ada" sebagai kelas valid.
  const willExistDapodikIds = new Set(rombelList.map((r) => r.rombongan_belajar_id));
  const willExistNames = new Set(rombelList.map((r) => r.nama));

  const siswaCount = { created: 0, updated: 0, archived: 0, errors: 0 };
  const gtkCount = { created: 0, updated: 0, archived: 0, errors: 0 };
  const rombelCount = { created: 0, updated: 0, errors: 0 };

  const matchedStudentIds = new Set<string>();
  for (const s of siswaList) {
    const hasRombel =
      (s.rombongan_belajar_id && willExistDapodikIds.has(s.rombongan_belajar_id)) ||
      (!!s.nama_rombel && willExistNames.has(s.nama_rombel));
    if (!hasRombel) {
      siswaCount.errors++;
      continue;
    }
    // Prioritas 1: peserta_didik_id (identitas stabil) — mencegah duplikasi
    // saat NIPD baru diisi/menghilang di Dapodik. Prioritas 2: nis (fallback
    // untuk siswa lama dari sync sebelum dapodikId disimpan).
    const existing = s.peserta_didik_id
      ? existingByDapodikId.get(s.peserta_didik_id)
      : undefined;
    const matched = existing ?? existingByNis.get(resolveNis(s));
    if (matched) {
      matchedStudentIds.add(matched.id);
      siswaCount.updated++;
    } else {
      siswaCount.created++;
    }
  }
  for (const id of allExistingIds) {
    if (!matchedStudentIds.has(id)) siswaCount.archived++;
  }

  const syncedGtkIds = new Set<string>();
  for (const g of gtkList) {
    const nuptk = normalize(g.nuptk);
    const nip = normalize(g.nip);
    if (!nuptk && !nip) {
      gtkCount.errors++;
      continue;
    }
    const found =
      (nuptk && teacherByNuptk.get(nuptk)) || (nip && teacherByNip.get(nip));

    if (found) {
      syncedGtkIds.add(found.id);
      gtkCount.updated++;
    } else {
      gtkCount.created++;
    }
  }
  for (const id of existingTeacherIds) {
    if (!syncedGtkIds.has(id)) gtkCount.archived++;
  }

  for (const r of rombelList) {
    if (classByDapodikId.has(r.rombongan_belajar_id) || classByName.has(r.nama)) {
      rombelCount.updated++;
    } else {
      rombelCount.created++;
    }
  }

  if (!archiveUnlisted) {
    siswaCount.archived = 0;
    gtkCount.archived = 0;
  }

  const result: SyncResult = {
    sekolah: { updated: 1 },
    siswa: siswaCount,
    gtk: gtkCount,
    rombel: rombelCount,
  };

  if (mode === "dry-run") {
    return { ...result, mode: "dry-run" };
  }

  // ---- Commit mode ----
  //
  // Strategi transaksi (lihat docs/dapodik-sync-transactions.md):
  // Interactive transaction Prisma punya timeout bawaan 5 detik. Payload nyata
  // (±500 siswa, ±30 GTK, ±12 rombel) membutuhkan ratusan query berurutan,
  // sehingga transaksi tunggal selalu melewati batas itu dan Prisma melempar
  // P2028 "Transaction not found" di tengah proses (mis. pada teacher.create).
  //
  // Perbaikan:
  //  1. Semua interactive transaction diberi maxWait/timeout eksplisit yang
  //     aman dan tetap di bawah batas request Vercel 60 detik.
  //  2. Query N+1 dihilangkan: GTK dicocokkan lewat map yang sudah dimuat,
  //     wali kelas memakai data kelas yang sudah ada di memori, dan
  //     pengarsipan memakai updateMany (bukan satu update per ID).
  //  3. Siswa diproses per-batch dalam transaksi terpisah agar tiap transaksi
  //     tetap pendek. Pengarsipan hanya dijalankan setelah SELURUH batch utama
  //     berhasil, sehingga siswa/guru baru tidak pernah langsung terarsip.
  await commitDapodikPayload({
    sekolah,
    siswaList,
    gtkList,
    rombelList,
    academicYear,
    archiveUnlisted,
    classByDapodikId,
    classByName,
    teacherByNuptk,
    teacherByNip,
    existingTeacherIds,
    existingByNis,
    existingByDapodikId,
    allExistingIds,
  });

  const isBridge = opts?.userId === "jembatan";
  const log = await db.activityLog.create({
    data: {
      userId: isBridge ? null : opts?.userId ?? null,
      userName: isBridge ? "Jembatan Dapodik" : "System",
      action: "CREATE",
      entity: "DapodikSync",
      detail: `Sinkronisasi Dapodik${isBridge ? " (jembatan)" : ""}: ${result.siswa.created + result.siswa.updated} siswa, ${result.gtk.created + result.gtk.updated} guru, ${result.rombel.created + result.rombel.updated} rombel`,
    },
  });

  await db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      npsn: sekolah.npsn || "",
      token: "",
      lastSyncAt: new Date(),
      lastSyncBy: opts?.userId ?? null,
    },
    update: {
      lastSyncAt: new Date(),
      ...(opts?.userId ? { lastSyncBy: opts.userId } : {}),
    },
  });

  return { ...result, mode: "commit", logId: log.id };
}

// ---- Konfigurasi transaksi commit ----
//
// Nilai dipilih agar total worst-case tetap di bawah batas request Vercel
// (maxDuration = 60 detik) sekaligus jauh di atas default Prisma 5 detik yang
// menyebabkan P2028 pada payload nyata.
export const DAPODIK_TX_OPTIONS = {
  /** Maksimum menunggu koneksi dari pool sebelum transaksi dimulai. */
  maxWait: 10_000,
  /** Batas hidup satu interactive transaction. */
  timeout: 25_000,
} as const;

/** Jumlah siswa per transaksi batch. */
export const DAPODIK_STUDENT_BATCH_SIZE = 100;

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("Ukuran batch harus lebih besar dari nol.");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type CommitArgs = {
  sekolah: DapodikSekolah;
  siswaList: DapodikSiswa[];
  gtkList: DapodikGTK[];
  rombelList: DapodikRombel[];
  academicYear: string;
  archiveUnlisted: boolean;
  classByDapodikId: Map<string, string>;
  classByName: Map<string, string>;
  teacherByNuptk: Map<string, { id: string }>;
  teacherByNip: Map<string, { id: string }>;
  existingTeacherIds: Set<string>;
  existingByNis: Map<string, { id: string }>;
  existingByDapodikId: Map<string, { id: string }>;
  allExistingIds: Set<string>;
};

export async function commitDapodikPayload(args: CommitArgs): Promise<void> {
  const {
    sekolah,
    siswaList,
    gtkList,
    rombelList,
    academicYear,
    archiveUnlisted,
    classByDapodikId,
    classByName,
    teacherByNuptk,
    teacherByNip,
    existingTeacherIds,
    existingByNis,
    existingByDapodikId,
    allExistingIds,
  } = args;

  const freshClassByDapodikId = new Map<string, string>();
  const freshClassByName = new Map<string, string>();
  const syncedGtk = new Set<string>();
  // Nama guru (lowercase) → id, dipakai untuk resolusi wali kelas tanpa
  // query findMany tambahan di dalam transaksi.
  const teacherIdByLowerName = new Map<string, string>();

  // ---- Transaksi 1: sekolah + rombel + GTK ----
  await db.$transaction(async (tx) => {
    const schoolAddress = resolveSchoolAddress(sekolah);
    await tx.siteSetting.upsert({
      where: { id: "singleton" },
      update: {
        npsn: sekolah.npsn,
        schoolName: sekolah.nama,
        ...(schoolAddress ? { address: schoolAddress } : {}),
      },
      create: {
        id: "singleton",
        npsn: sekolah.npsn,
        schoolName: sekolah.nama,
        address: schoolAddress ?? "",
        vision: "",
        mission: "",
        history: "",
        principalWelcome: "",
        spmbInfo: "",
      },
    });

    // Rombel → Class, matching via dapodikId, fallback ke nama.
    for (const r of rombelList) {
      const grade = r.tingkat_pendidikan_id_str || "1";
      const existingId = classByDapodikId.get(r.rombongan_belajar_id) ?? classByName.get(r.nama);
      if (existingId) {
        await tx.class.update({
          where: { id: existingId },
          data: { name: r.nama, grade, academicYear, dapodikId: r.rombongan_belajar_id },
        });
        freshClassByDapodikId.set(r.rombongan_belajar_id, existingId);
        freshClassByName.set(r.nama, existingId);
      } else {
        const created = await tx.class.create({
          data: { name: r.nama, grade, academicYear, dapodikId: r.rombongan_belajar_id },
        });
        freshClassByDapodikId.set(r.rombongan_belajar_id, created.id);
        freshClassByName.set(r.nama, created.id);
      }
    }

    // GTK — matching NUPTK dulu, lalu NIP, memakai map yang sudah dimuat di
    // luar transaksi (menghilangkan findFirst per guru / N+1).
    for (const g of gtkList) {
      const nuptk = normalize(g.nuptk);
      const nip = normalize(g.nip);
      if (!nuptk && !nip) continue;
      const matched =
        (nuptk ? teacherByNuptk.get(nuptk) : undefined) ??
        (nip ? teacherByNip.get(nip) : undefined);

      const teacherData = {
        name: g.nama,
        position: normalize(g.jabatan_ptk_id_str) || normalize(g.jenis_ptk_id_str) || "Guru",
        nuptk,
        nip,
        nik: normalize(g.nik),
        gender: mapGender(g.jenis_kelamin),
        tempatLahir: normalize(g.tempat_lahir),
        tanggalLahir: parseDate(g.tanggal_lahir),
        agama: normalize(g.agama_id_str),
        statusKepegawaian: normalize(g.status_kepegawaian_id_str),
        jenisPtk: normalize(g.jenis_ptk_id_str),
        pangkatGolongan: normalize(g.pangkat_golongan_terakhir),
        education: normalize(g.pendidikan_terakhir),
        bidangStudi: normalize(g.bidang_studi_terakhir),
      };

      let teacherId: string;
      if (matched) {
        await tx.teacher.update({
          where: { id: matched.id },
          data: { ...teacherData, archivedAt: null, isActive: true },
        });
        teacherId = matched.id;
      } else {
        const created = await tx.teacher.create({ data: teacherData });
        teacherId = created.id;
        // Daftarkan ke map supaya duplikat dalam payload yang sama
        // (NUPTK/NIP identik) tidak membuat guru kedua.
        if (nuptk) teacherByNuptk.set(nuptk, { id: teacherId });
        if (nip) teacherByNip.set(nip, { id: teacherId });
      }
      syncedGtk.add(teacherId);
      if (g.nama) teacherIdByLowerName.set(g.nama.trim().toLowerCase(), teacherId);
    }

    // Wali kelas — dari ptk_id_str pada rombel. Hanya guru yang baru saja
    // disinkronkan (aktif) yang dipakai, tanpa findMany/findUnique per rombel.
    for (const r of rombelList) {
      const classId = freshClassByDapodikId.get(r.rombongan_belajar_id);
      const waliName = r.ptk_id_str?.trim();
      if (!classId || !waliName) continue;
      const teacherId = teacherIdByLowerName.get(waliName.toLowerCase());
      if (!teacherId) continue;
      await tx.class.updateMany({
        where: { id: classId, NOT: { homeroomTeacherId: teacherId } },
        data: { homeroomTeacherId: teacherId },
      });
      await tx.user.updateMany({
        where: { name: waliName, role: "GURU" },
        data: { guardianClassId: classId },
      });
    }
  }, DAPODIK_TX_OPTIONS);

  // ---- Transaksi 2..n: siswa per batch ----
  // Tiap batch adalah transaksi tersendiri yang pendek sehingga tidak pernah
  // menyentuh batas timeout. Pengarsipan sengaja ditunda sampai semua batch
  // selesai agar kegagalan di tengah tidak mengarsipkan siswa yang valid.
  const syncedStudentIds = new Set<string>();
  const batches = chunk(siswaList, DAPODIK_STUDENT_BATCH_SIZE);

  for (const batch of batches) {
    await db.$transaction(async (tx) => {
      for (const s of batch) {
        const classId =
          (s.rombongan_belajar_id
            ? freshClassByDapodikId.get(s.rombongan_belajar_id)
            : undefined) ??
          (s.nama_rombel ? freshClassByName.get(s.nama_rombel) : undefined);
        if (!classId) continue; // rombel tidak ditemukan, lewati siswa ini

        const nis = resolveNis(s);
        const nisn = normalize(s.nisn);

        const studentData = {
          nis,
          nisn,
          dapodikId: s.peserta_didik_id || null,
          name: s.nama,
          dateOfBirth: parseDate(s.tanggal_lahir),
          gender: mapGender(s.jenis_kelamin),
          address: s.alamat_jalan || null,
          parentName: combineParentName(s.nama_ayah, s.nama_ibu),
          classId,
        };

        // Matching: peserta_didik_id dulu (identitas stabil), lalu NIS.
        const matched =
          (s.peserta_didik_id ? existingByDapodikId.get(s.peserta_didik_id) : undefined) ??
          existingByNis.get(nis);

        if (matched) {
          await tx.student.update({
            where: { id: matched.id },
            data: { ...studentData, archivedAt: null, isActive: true },
          });
          syncedStudentIds.add(matched.id);
        } else {
          const created = await tx.student.create({ data: studentData });
          syncedStudentIds.add(created.id);
          // Cegah duplikat bila payload memuat siswa yang sama dua kali.
          if (s.peserta_didik_id) existingByDapodikId.set(s.peserta_didik_id, { id: created.id });
          existingByNis.set(nis, { id: created.id });
        }
      }
    }, DAPODIK_TX_OPTIONS);
  }

  // ---- Pengarsipan (setelah semua batch utama sukses) ----
  // archiveUnlisted tetap dihormati; tidak ada penghapusan data. Hanya data
  // yang SUDAH ADA sebelum sync dan tidak muncul di Dapodik yang diarsipkan,
  // sehingga siswa/guru yang baru dibuat tidak mungkin ikut terarsip.
  if (!archiveUnlisted) return;

  const teacherIdsToArchive = [...existingTeacherIds].filter((id) => !syncedGtk.has(id));
  const studentIdsToArchive = [...allExistingIds].filter((id) => !syncedStudentIds.has(id));
  if (teacherIdsToArchive.length === 0 && studentIdsToArchive.length === 0) return;

  const archivedAt = new Date();
  await db.$transaction(async (tx) => {
    for (const ids of chunk(teacherIdsToArchive, ARCHIVE_CHUNK_SIZE)) {
      await tx.teacher.updateMany({
        where: { id: { in: ids } },
        data: { archivedAt, isActive: false },
      });
    }
    for (const ids of chunk(studentIdsToArchive, ARCHIVE_CHUNK_SIZE)) {
      await tx.student.updateMany({
        where: { id: { in: ids } },
        data: { archivedAt, isActive: false },
      });
    }
  }, DAPODIK_TX_OPTIONS);
}

/** Batas jumlah ID per updateMany agar query tidak terlalu besar. */
export const ARCHIVE_CHUNK_SIZE = 500;
