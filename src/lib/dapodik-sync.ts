import { db } from "@/lib/db";
import { DapodikClient, type DapodikConfig as DapodikClientConfig } from "@/lib/dapodik-client";

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
  jabatan?: string;
};

type DapodikRombel = {
  rombongan_belajar_id: string; // disimpan sebagai Class.dapodikId
  nama: string;
  tingkat_pendidikan_id_str?: string;
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

// nis wajib unik & tidak boleh kosong. Utamakan nipd (NIS lokal); kalau
// tidak ada, pakai peserta_didik_id (selalu ada & unik dari Dapodik)
// supaya tidak pernah gagal karena nis null/duplikat.
export function resolveNis(s: DapodikSiswa): string {
  return normalize(s.nipd) ?? s.peserta_didik_id;
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
}) {
  return db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
}

export async function getDapodikConfig() {
  const config = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!config) return null;
  return {
    ...config,
    token: config.token.slice(0, 4) + "****" + config.token.slice(-4),
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

  const [sekolahRaw, siswaRaw, gtkRaw, rombelRaw] = await Promise.all([
    client.getSekolah(),
    client.getPesertaDidik(),
    client.getGTK(),
    client.getRombonganBelajar(),
  ]);

  const siswaList = (Array.isArray(siswaRaw) ? siswaRaw : [siswaRaw]) as DapodikSiswa[];
  const gtkList = (Array.isArray(gtkRaw) ? gtkRaw : [gtkRaw]) as DapodikGTK[];
  const rombelList = (Array.isArray(rombelRaw) ? rombelRaw : [rombelRaw]) as DapodikRombel[];
  const sekolah = sekolahRaw as DapodikSekolah;

  // Existing DB state
  const existingStudents = await db.student.findMany({
    select: { id: true, nis: true, nisn: true },
  });
  const existingByNis = new Map(existingStudents.map((s) => [s.nis, { id: s.id }]));

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

  for (const s of siswaList) {
    if (!s.rombongan_belajar_id || !willExistDapodikIds.has(s.rombongan_belajar_id)) {
      siswaCount.errors++;
      continue;
    }
    const nis = resolveNis(s);
    if (existingByNis.has(nis)) {
      siswaCount.updated++;
    } else {
      siswaCount.created++;
    }
  }
  const syncedNisSet = new Set(siswaList.map((s) => resolveNis(s)));
  for (const [nis] of existingByNis) {
    if (!syncedNisSet.has(nis)) siswaCount.archived++;
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
    await tx.siteSetting.update({
      where: { id: "singleton" },
      data: {
        npsn: sekolah.npsn,
        schoolName: sekolah.nama,
        address: sekolah.alamat,
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
            position: g.jabatan || "Guru",
            nuptk: g.nuptk || null,
            nip: g.nip || null,
            archivedAt: null,
          },
        });
      } else {
        const created = await tx.teacher.create({
          data: {
            name: g.nama,
            position: g.jabatan || "Guru",
            nuptk: g.nuptk || null,
            nip: g.nip || null,
          },
        });
        syncedGtk.add(created.id);
      }
    }
    for (const id of existingTeacherIds) {
      if (!syncedGtk.has(id)) {
        await tx.teacher.update({
          where: { id },
          data: { archivedAt: new Date(), isActive: false },
        });
      }
    }

    // Siswa — classId dari rombongan_belajar_id, bukan nama
    const syncedNis = new Set<string>();

    for (const s of siswaList) {
      if (!s.rombongan_belajar_id) continue;
      const classId = freshClassByDapodikId.get(s.rombongan_belajar_id);
      if (!classId) continue; // rombel tidak ditemukan, lewati siswa ini

      const nis = resolveNis(s);
      const nisn = normalize(s.nisn);
      syncedNis.add(nis);

      const studentData = {
        nis,
        nisn,
        name: s.nama,
        dateOfBirth: parseDate(s.tanggal_lahir),
        gender: mapGender(s.jenis_kelamin),
        address: s.alamat_jalan || null,
        parentName: combineParentName(s.nama_ayah, s.nama_ibu),
        classId,
      };

      const existing = existingByNis.get(nis);
      if (existing) {
        await tx.student.update({
          where: { id: existing.id },
          data: { ...studentData, archivedAt: null, isActive: true },
        });
      } else {
        await tx.student.create({ data: studentData });
      }
    }

    for (const [nis, { id }] of existingByNis) {
      if (!syncedNis.has(nis)) {
        await tx.student.update({
          where: { id },
          data: { archivedAt: new Date(), isActive: false },
        });
      }
    }
  });

  const log = await db.activityLog.create({
    data: {
      userId: "",
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