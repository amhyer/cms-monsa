import { db } from "@/lib/db";
import { DapodikClient, type DapodikConfig as DapodikClientConfig } from "@/lib/dapodik-client";
import { encrypt, decrypt, isEncrypted } from "@/lib/encryption";
import { logger } from "@/lib/logger";

// ---- Types (dikonfirmasi dari response Dapodik asli) ----

type DapodikSiswa = {
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

type DapodikGTK = {
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

type DapodikRombel = {
  rombongan_belajar_id: string; // disimpan sebagai Class.dapodikId
  nama: string;
  tingkat_pendidikan_id_str?: string;
  ptk_id_str?: string; // nama wali kelas
};

type DapodikSekolah = {
  nama: string;
  npsn: string;
  alamat: string;
};

export type SyncResult = {
  sekolah: { updated: number };
  siswa: { created: number; updated: number; archived: number; errors: number };
  gtk: { created: number; updated: number; archived: number; errors: number };
  rombel: { created: number; updated: number; errors: number };
};

export type DryRunResult = SyncResult & { mode: "dry-run" };
export type CommitResult = SyncResult & { mode: "commit"; logId: string };

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
  if (grade) {
    const now = new Date();
    // Angkatan = tahun saat ini − (kelas − 1)
    // Kelas 1 thn 2026 → angkatan 2026 → 2627
    // Kelas 3 thn 2026 → angkatan 2024 → 2425
    const angkatan = now.getFullYear() - (grade - 1);
    const yy = angkatan % 100;
    const yyNext = (yy + 1) % 100;
    // 3 digit deterministik dari nama siswa (001–999)
    const hash = Array.from(s.nama).reduce(
      (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
      0,
    );
    const seq = (Math.abs(hash) % 999) + 1;
    return `${String(yy).padStart(2, "0")}${String(yyNext).padStart(2, "0")}07${String(seq).padStart(4, "0")}`;
  }

  // Terakhir: hash deterministik dari nama (bukan UUID)
  // Guard: bila nama kosong, pakai peserta_didik_id sebagai fallback mutlak
  if (!s.nama) return s.peserta_didik_id;
  const hash = Array.from(s.nama).reduce(
    (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
    0,
  );
  return String(Math.abs(hash)).padStart(10, "0");
}

// ---- Get Dapodik Client from DB config ----

export async function getDapodikClient(): Promise<DapodikClient> {
  const config = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!config) {
    throw new Error("Konfigurasi Dapodik belum diatur. Silakan simpan konfigurasi terlebih dahulu.");
  }

  // Dekripsi token — support backward compatibility (data lama belum terenkripsi)
  let token = config.token;
  try {
    if (isEncrypted(token)) {
      token = decrypt(token);
    } else if (process.env.DAPODIK_ENCRYPTION_KEY) {
      // Data lama belum terenkripsi tapi key sudah ada → enkripsi ulang
      logger.info("[dapodik] Mengenkripsi token lama yang belum terenkripsi");
      await db.dapodikConfig.update({
        where: { id: "singleton" },
        data: { token: encrypt(token) },
      });
    }
  } catch (err) {
    logger.error({ err }, "[dapodik] Gagal dekripsi token");
    // Lanjut dengan token asli — mungkin memang belum terenkripsi
  }

  // Dekripsi CF Access Client Secret (jika ada)
  let cfAccessClientSecret = config.cfAccessClientSecret ?? undefined;
  if (cfAccessClientSecret) {
    try {
      if (isEncrypted(cfAccessClientSecret)) {
        cfAccessClientSecret = decrypt(cfAccessClientSecret);
      } else if (process.env.DAPODIK_ENCRYPTION_KEY) {
        const encrypted = encrypt(cfAccessClientSecret);
        await db.dapodikConfig.update({
          where: { id: "singleton" },
          data: { cfAccessClientSecret: encrypted },
        });
        cfAccessClientSecret = decrypt(encrypted);
      }
    } catch (err) {
      logger.error({ err }, "[dapodik] Gagal dekripsi cfAccessClientSecret");
    }
  }

  const clientConfig: DapodikClientConfig = {
    npsn: config.npsn,
    token,
    host: config.host,
    port: config.port,
    protocol: config.protocol as "http" | "https",
    allowInsecureInProduction: config.allowInsecureInProduction,
    cfAccessClientId: config.cfAccessClientId ?? undefined,
    cfAccessClientSecret,
  };
  return new DapodikClient(clientConfig);
}

// ---- Save Config ----

export async function saveDapodikConfig(data: {
  npsn: string;
  token: string;
  host: string;
  port: number;
  protocol: string;
  archiveUnlisted?: boolean;
  allowInsecureInProduction?: boolean;
  cfAccessClientId?: string | null;
  cfAccessClientSecret?: string | null;
}) {
  // Enkripsi token & cfAccessClientSecret sebelum simpan ke DB
  const encryptionKey = process.env.DAPODIK_ENCRYPTION_KEY;
  const tokenToSave = encryptionKey ? encrypt(data.token) : data.token;
  const cfSecretToSave = data.cfAccessClientSecret && encryptionKey
    ? encrypt(data.cfAccessClientSecret)
    : data.cfAccessClientSecret ?? null;

  return db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      ...data,
      token: tokenToSave,
      cfAccessClientSecret: cfSecretToSave,
    },
    update: {
      npsn: data.npsn,
      token: tokenToSave,
      host: data.host,
      port: data.port,
      protocol: data.protocol,
      archiveUnlisted: data.archiveUnlisted,
      allowInsecureInProduction: data.allowInsecureInProduction,
      cfAccessClientId: data.cfAccessClientId ?? null,
      cfAccessClientSecret: cfSecretToSave,
    },
  });
}

export async function getDapodikConfig() {
  const config = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!config) return null;
  return {
    ...config,
    // Mask token — jangan pernah kirim token asli/dekripsi ke client
    token: config.token.slice(0, 4) + "****" + config.token.slice(-4),
    // CF Access Client ID tampil penuh (bukan secret), tapi secret di-mask
    cfAccessClientSecret: config.cfAccessClientSecret
      ? config.cfAccessClientSecret.slice(0, 4) + "****" + config.cfAccessClientSecret.slice(-4)
      : null,
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
  mode: "dry-run" | "commit"
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

  const siswaList = (Array.isArray(siswaRaw) ? siswaRaw : [siswaRaw]) as DapodikSiswa[];
  const gtkList = (Array.isArray(gtkRaw) ? gtkRaw : [gtkRaw]) as DapodikGTK[];
  const rombelList = (Array.isArray(rombelRaw) ? rombelRaw : [rombelRaw]) as DapodikRombel[];

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

  const siswaCount = { created: 0, updated: 0, archived: 0, errors: 0 };
  const gtkCount = { created: 0, updated: 0, archived: 0, errors: 0 };
  const rombelCount = { created: 0, updated: 0, errors: 0 };

  const matchedStudentIds = new Set<string>();
  for (const s of siswaList) {
    if (!s.rombongan_belajar_id || !willExistDapodikIds.has(s.rombongan_belajar_id)) {
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
    const identifier = g.nuptk || g.nip;
    if (!identifier) {
      gtkCount.errors++;
      continue;
    }
    const found =
      (g.nuptk && teacherByNuptk.get(g.nuptk)) || (g.nip && teacherByNip.get(g.nip));

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
  await db.$transaction(async (tx) => {
    await tx.siteSetting.upsert({
      where: { id: "singleton" },
      update: {
        npsn: sekolah.npsn,
        schoolName: sekolah.nama,
        address: sekolah.alamat,
      },
      create: {
        id: "singleton",
        npsn: sekolah.npsn,
        schoolName: sekolah.nama,
        address: sekolah.alamat,
        vision: "",
        mission: "",
        history: "",
        principalWelcome: "",
        spmbInfo: "",
      },
    });

    // Rombel → Class, matching via dapodikId, fallback ke nama
    const freshClassByDapodikId = new Map<string, string>();
    for (const r of rombelList) {
      const grade = r.tingkat_pendidikan_id_str || "1";
      const existingId = classByDapodikId.get(r.rombongan_belajar_id) ?? classByName.get(r.nama);

      if (existingId) {
        await tx.class.update({
          where: { id: existingId },
          data: { name: r.nama, grade, academicYear, dapodikId: r.rombongan_belajar_id },
        });
        freshClassByDapodikId.set(r.rombongan_belajar_id, existingId);
      } else {
        const created = await tx.class.create({
          data: { name: r.nama, grade, academicYear, dapodikId: r.rombongan_belajar_id },
        });
        freshClassByDapodikId.set(r.rombongan_belajar_id, created.id);
      }
    }

    // GTK
    const syncedGtk = new Set<string>();
    for (const g of gtkList) {
      const identifier = g.nuptk || g.nip;
      if (!identifier) continue;
      const existing = await tx.teacher.findFirst({
        where: { OR: [{ nuptk: identifier }, { nip: identifier }] },
      });
      if (existing) {
        syncedGtk.add(existing.id);
        await tx.teacher.update({
          where: { id: existing.id },
          data: {
            name: g.nama,
            position: normalize(g.jabatan_ptk_id_str) || normalize(g.jenis_ptk_id_str) || "Guru",
            nuptk: g.nuptk || null,
            nip: g.nip || null,
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
            archivedAt: null,
          },
        });
      } else {
        const created = await tx.teacher.create({
          data: {
            name: g.nama,
            position: normalize(g.jabatan_ptk_id_str) || normalize(g.jenis_ptk_id_str) || "Guru",
            nuptk: g.nuptk || null,
            nip: g.nip || null,
            nik: normalize(g.nik),
            gender: mapGender(g.jenis_kelamin),
            tempatLahir: normalize(g.tempat_lahir),
            tanggalLahir: parseDate(g.tanggal_lahir),
            agama: normalize(g.agama_id_str),
            statusKepegawaian: normalize(g.status_kepegawaian_id_str),
            jenisPtk: normalize(g.jenis_ptk_id_str),
            pangkatGolongan: normalize(g.pangkat_golongan_terakhir),
            bidangStudi: normalize(g.bidang_studi_terakhir),
          },
        });
        syncedGtk.add(created.id);
      }
    }
    for (const id of existingTeacherIds) {
      if (!syncedGtk.has(id) && archiveUnlisted) {
        await tx.teacher.update({
          where: { id },
          data: { archivedAt: new Date(), isActive: false },
        });
      }
    }

    // Wali kelas — diambil dari Dapodik (ptk_id_str pada rombel), dipasang ke
    // Class.homeroomTeacherId dan User.guardianClassId (akun GURU wali kelas).
    const waliTeachers = await tx.teacher.findMany({ where: { archivedAt: null } });
    const teacherByLowerName = new Map(
      waliTeachers.map((t) => [t.name.trim().toLowerCase(), t])
    );
    for (const r of rombelList) {
      const classId = freshClassByDapodikId.get(r.rombongan_belajar_id);
      const waliName = r.ptk_id_str?.trim();
      if (!classId || !waliName) continue;
      const teacher = teacherByLowerName.get(waliName.toLowerCase());
      if (!teacher) continue;
      const cls = await tx.class.findUnique({
        where: { id: classId },
        select: { homeroomTeacherId: true },
      });
      if (cls && cls.homeroomTeacherId !== teacher.id) {
        await tx.class.update({
          where: { id: classId },
          data: { homeroomTeacherId: teacher.id },
        });
      }
      await tx.user.updateMany({
        where: { name: teacher.name, role: "GURU" },
        data: { guardianClassId: classId },
      });
    }

    // Siswa — classId dari rombongan_belajar_id, bukan nama.
    // Matching diprioritaskan via peserta_didik_id (identitas stabil);
    // nis hanya fallback untuk data lama dari sync sebelum dapodikId disimpan.
    const syncedStudentIds = new Set<string>();

    for (const s of siswaList) {
      if (!s.rombongan_belajar_id) continue;
      const classId = freshClassByDapodikId.get(s.rombongan_belajar_id);
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

      const existing = s.peserta_didik_id
        ? existingByDapodikId.get(s.peserta_didik_id)
        : undefined;
      const matched = existing ?? existingByNis.get(nis);
      if (matched) {
        syncedStudentIds.add(matched.id);
        await tx.student.update({
          where: { id: matched.id },
          data: { ...studentData, archivedAt: null, isActive: true },
        });
      } else {
        const created = await tx.student.create({ data: studentData });
        syncedStudentIds.add(created.id);
      }
    }

    // Arsipkan siswa yang tidak ada di Dapodik (tidak di-sync dari Dapodik manapun).
    // Menggunakan allExistingIds supaya siswa yang matched via dapodikId saja
    // (tanpa NIS di existingByNis) juga ikut diperiksa.
    for (const id of allExistingIds) {
      if (syncedStudentIds.has(id)) continue;
      if (archiveUnlisted) {
        await tx.student.update({
          where: { id },
          data: { archivedAt: new Date(), isActive: false },
        });
      }
    }
  });

  const log = await db.activityLog.create({
    data: {
      userId: null,
      userName: "System",
      action: "CREATE",
      entity: "DapodikSync",
      detail: `Sinkronisasi Dapodik: ${result.siswa.created + result.siswa.updated} siswa, ${result.gtk.created + result.gtk.updated} guru, ${result.rombel.created + result.rombel.updated} rombel`,
    },
  });

  await db.dapodikConfig.update({
    where: { id: "singleton" },
    data: { lastSyncAt: new Date() },
  });

  return { ...result, mode: "commit", logId: log.id };
}