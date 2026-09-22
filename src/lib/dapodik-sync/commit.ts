// Lapisan transaksi DB sync Dapodik (eksekusi commit + arsip) — diekstrak
// dari dapodik-sync.ts (P2-2). Strategi transaksi didokumentasikan di
// docs/dapodik-sync-transactions.md.
import { db } from "@/lib/db";
import {
  combineParentName,
  mapGender,
  normalize,
  parseDate,
  resolveNis,
  resolveSchoolAddress,
} from "@/lib/dapodik-sync-helpers";
import type {
  ArchiveResult,
  DapodikGTK,
  DapodikRombel,
  DapodikSekolah,
  DapodikSiswa,
} from "./types";

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

export type CommitArgs = {
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
    // Payload parsial (dataType gtk/rombel/peserta_didik) membawa sekolah
    // kosong — JANGAN timpa siteSetting (nama/npsn/alamat sekolah) dengan
    // nilai kosong. Hanya modul "sekolah" yang meng-update siteSetting.
    const hasSchool = !!normalize(sekolah.nama) && !!normalize(sekolah.npsn);
    if (hasSchool) {
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
    }

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

/**
 * Arsipkan siswa/guru yang TIDAK ada di daftar ID Dapodik yang diberikan.
 * Dipakai setelah sync berchunk (lihat docs/SYNC-DAPODIK-PYTHON.md): script
 * Python mengirim data per-chunk dengan archiveUnlisted:false, lalu memanggil
 * endpoint ini sekali dengan daftar lengkap peserta_didik_id + NUPTK/NIP agar
 * data yang tidak muncul lagi di Dapodik diarsipkan. Hanya 2-3 query — aman
 * di bawah batas waktu Vercel Hobby (10 detik).
 */
export async function archiveDapodikUnlisted(args: {
  pesertaDidikIds: string[];
  gtkIds: string[];
}): Promise<ArchiveResult> {
  const { pesertaDidikIds, gtkIds } = args;
  const archivedAt = new Date();

  // Map dapodikId -> id internal (hanya yang masih aktif & belum diarsip).
  const [activeStudents, activeTeachers] = await Promise.all([
    db.student.findMany({
      where: { archivedAt: null },
      select: { id: true, dapodikId: true },
    }),
    db.teacher.findMany({
      where: { archivedAt: null },
      select: { id: true, nuptk: true, nip: true },
    }),
  ]);

  const pdIdSet = new Set(pesertaDidikIds.filter(Boolean));
  const gtkIdSet = new Set(gtkIds.filter(Boolean));

  const studentsToArchive = activeStudents
    .filter((s) => s.dapodikId && !pdIdSet.has(s.dapodikId))
    .map((s) => s.id);
  const teachersToArchive = activeTeachers
    .filter(
      (t) =>
        (!t.nuptk || !gtkIdSet.has(t.nuptk)) && (!t.nip || !gtkIdSet.has(t.nip))
    )
    .filter((t) => {
      // Guru tanpa NUPTK & NIP tidak bisa dicocokkan — jangan arsip.
      return !!(t.nuptk || t.nip);
    })
    .map((t) => t.id);

  let siswaArchived = 0;
  let gtkArchived = 0;
  if (studentsToArchive.length > 0) {
    for (const ids of chunk(studentsToArchive, ARCHIVE_CHUNK_SIZE)) {
      const r = await db.student.updateMany({
        where: { id: { in: ids } },
        data: { archivedAt, isActive: false },
      });
      siswaArchived += r.count;
    }
  }
  if (teachersToArchive.length > 0) {
    for (const ids of chunk(teachersToArchive, ARCHIVE_CHUNK_SIZE)) {
      const r = await db.teacher.updateMany({
        where: { id: { in: ids } },
        data: { archivedAt, isActive: false },
      });
      gtkArchived += r.count;
    }
  }

  return { siswaArchived, gtkArchived };
}
