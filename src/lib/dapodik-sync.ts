import { db } from "@/lib/db";
import {
  DapodikClient,
  type Sekolah,
} from "@/lib/dapodik-client";

// ---------------------------------------------------------------------------
// Helper untuk memetakan data Dapodik ke model CMS
// ---------------------------------------------------------------------------

/** Dapodik "L"/"P" -> enum gender CMS (LAKI_LAKI | PEREMPUAN). */
export function mapGender(jk?: string): "LAKI_LAKI" | "PEREMPUAN" | null {
  if (jk === "L") return "LAKI_LAKI";
  if (jk === "P") return "PEREMPUAN";
  return null;
}

/**
 * Terjemahkan tingkat_pendidikan_id Dapodik ke grade CMS.
 * SD: "1".."6", SMP: "7".."9", SMA/SMK: "10".."12".
 * Nilai yang tidak dikenal difallback ke "1".
 */
export function resolveGrade(tingkatPendidikanId?: string): string {
  if (!tingkatPendidikanId) return "1";
  const n = Number.parseInt(tingkatPendidikanId, 10);
  if (Number.isNaN(n) || n < 1 || n > 12) return "1";
  return String(n);
}

/** "20241" -> "2024/2025" (tahun ajaran untuk Class.academicYear). */
export function tahunAjaranFromSemester(semesterId?: string): string {
  if (!semesterId || !/^[0-9]{4}[12]$/.test(semesterId)) {
    const y = new Date().getFullYear();
    return `${y}/${y + 1}`;
  }
  const y = Number(semesterId.slice(0, 4));
  return `${y}/${y + 1}`;
}

/**
 * Baca konfigurasi Dapodik dari DB dan buat client siap pakai.
 * Lempar error jelas kalau konfigurasi belum pernah disimpan.
 */
export async function getDapodikClient(): Promise<DapodikClient> {
  const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!cfg) {
    throw new Error(
      "Konfigurasi Dapodik belum disimpan. Simpan NPSN & token di halaman Penarikan Data Dapodik terlebih dahulu."
    );
  }
  return new DapodikClient({
    npsn: cfg.npsn,
    token: cfg.token,
    host: cfg.host,
    port: cfg.port,
    protocol: cfg.protocol as "http" | "https",
    allowInsecureInProduction: true,
  });
}

// ---------------------------------------------------------------------------
// Sinkronisasi data ke database CMS
// ---------------------------------------------------------------------------

export type SyncCounts = {
  siswa: { update: number; create: number; error: number; archived: number };
  rombel: { update: number; create: number; error: number };
  gtk: { update: number; create: number; error: number };
};

export type SyncResult = {
  counts: SyncCounts;
  sekolah: Sekolah | null;
  semesterId: string | null;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Matching GTK -> Teacher
// ---------------------------------------------------------------------------

export type GtkTargetDecision =
  | { action: "create" }
  | { action: "update"; id: string }
  | { action: "skip"; reason: string };

/** Kandidat guru dari tabel Teacher untuk keputusan matching. */
export type GtkTargetCandidate = {
  id: string;
  isActive: boolean;
  nuptk: string | null;
  nip: string | null;
};

/**
 * Putuskan nasib satu GTK Dapodik terhadap tabel Teacher.
 *
 * Prioritas matching:
 * 1. Identitas akurat — NUPTK/NIP GTK cocok dengan NUPTK/NIP yang tersimpan
 *    (identitas unik per orang, lebih andal daripada nama).
 * 2. Nama — fallback untuk guru yang identitasnya belum tersimpan/berbeda.
 *
 * Aturan nama: 0 match -> dibuat; 1 match -> diperbarui (reaktivasi), KECUALI
 * guru itu sudah punya NUPTK/NIP yang BERBEDA (bisa orang lain bernama sama)
 * -> dilewati agar tidak menimpa. Beberapa nama sama -> prefer reaktivasi satu
 * yang nonaktif (biasanya duplikat lama); jika tak bisa dibedakan -> dilewati
 * dengan alasan jelas.
 */
export function resolveGtkTarget(opts: {
  identifierMatch: GtkTargetCandidate | null;
  nameMatches: GtkTargetCandidate[];
  nuptk: string | null;
  nip: string | null;
  name: string;
}): GtkTargetDecision {
  const { identifierMatch, nameMatches, nuptk, nip, name } = opts;
  const hasIdentifier = Boolean(nuptk || nip);

  // 1) Identitas akurat: NUPTK/NIP cocok -> update guru itu.
  if (identifierMatch) return { action: "update", id: identifierMatch.id };

  if (nameMatches.length === 0) return { action: "create" };

  // 2) Satu nama cocok.
  if (nameMatches.length === 1) {
    const m = nameMatches[0];
    // Jangan timpa guru yang sudah punya NUPTK/NIP BERBEDA — bisa jadi orang
    // lain dengan nama sama. Serahkan ke operator untuk dicek manual.
    if (
      hasIdentifier &&
      ((m.nuptk && m.nuptk !== nuptk) || (m.nip && m.nip !== nip))
    ) {
      return {
        action: "skip",
        reason: `GTK "${name}": identitas (NUPTK/NIP) berbeda dengan guru bernama sama yang sudah tersimpan — periksa manual`,
      };
    }
    return { action: "update", id: m.id };
  }

  // 3) Beberapa nama sama.
  if (!hasIdentifier) {
    const inactive = nameMatches.filter((m) => !m.isActive);
    if (inactive.length === 1) return { action: "update", id: inactive[0].id };
    return {
      action: "skip",
      reason: `GTK "${name}": ${nameMatches.length} guru bernama sama dan tidak bisa dibedakan (tanpa NUPTK/NIP) — perbarui data di Dapodik`,
    };
  }

  // Ada identitas tapi belum tersimpan: prefer kandidat yang identitasnya
  // kosong atau cocok (jangan menimpa identitas berbeda yang sudah ada).
  const compatible = nameMatches.filter(
    (m) => !((m.nuptk && m.nuptk !== nuptk) || (m.nip && m.nip !== nip))
  );
  if (compatible.length === 1) return { action: "update", id: compatible[0].id };
  return {
    action: "skip",
    reason: `GTK "${name}": ${nameMatches.length} guru bernama sama dan identitas belum bisa dipetakan — periksa manual`,
  };
}

type SyncOptions = {
  semesterId?: string;
  /** true = hanya hitung (preview), tanpa menulis ke DB. */
  dryRun?: boolean;
  /** Dipakai untuk mencatat lastSyncBy. */
  byUser?: { id: string; name: string } | null;
};

/**
 * Tarik semua data Dapodik (sekolah, siswa, guru, rombel) lalu sinkronkan ke
 * database CMS: siswa -> Student, GTK -> Teacher, rombel -> Class.
 *
 * Matching siswa->kelas: lewat rombongan_belajar_id ATAU nama_rombel.
 * Guru tanpa NUPTK/NIP tetap disinkronkan lewat pencocokan nama (lihat
 * resolveGtkTarget) — hanya dilewati jika namanya ambigu (beberapa guru
 * aktif bernama sama), karena tanpa NUPTK/NIP tidak bisa dibedakan.
 */
export async function runSync(opts: SyncOptions = {}): Promise<SyncResult> {
  const { semesterId, dryRun = false, byUser = null } = opts;
  const errors: string[] = [];
  const counts: SyncCounts = {
    siswa: { update: 0, create: 0, error: 0, archived: 0 },
    rombel: { update: 0, create: 0, error: 0 },
    gtk: { update: 0, create: 0, error: 0 },
  };

  const client = await getDapodikClient();
  const data = await client.getAllData(semesterId || undefined);

  // --- Rombel -> Class -----------------------------------------------------
  // Buat peta rombel (by id & by nama) untuk matching siswa ke kelas.
  const classByRombelId = new Map<string, string>();
  const classByName = new Map<string, string>();

  for (const rb of data.rombel) {
    try {
      const existing = await db.class.findFirst({
        where: { name: rb.nama },
      });
      const grade = resolveGrade(rb.tingkat_pendidikan_id);
      const academicYear = tahunAjaranFromSemester(rb.semester_id ?? semesterId);

      let classId: string;
      if (existing) {
        if (!dryRun) {
          await db.class.update({
            where: { id: existing.id },
            data: { grade, academicYear, isActive: true },
          });
        }
        classId = existing.id;
        counts.rombel.update++;
      } else {
        if (!dryRun) {
          const created = await db.class.create({
            data: { name: rb.nama, grade, academicYear, isActive: true },
          });
          classId = created.id;
        } else {
          classId = `dry:${rb.nama}`;
        }
        counts.rombel.create++;
      }

      classByRombelId.set(rb.rombongan_belajar_id, classId);
      classByName.set(rb.nama.toLowerCase(), classId);
    } catch (e) {
      counts.rombel.error++;
      errors.push(`Rombel "${rb.nama}": ${e instanceof Error ? e.message : "gagal"}`);
    }
  }

  // --- Siswa -> Student ----------------------------------------------------
  const siswaKeys = new Set<string>();
  for (const pd of data.peserta_didik) {
    try {
      // Identitas siswa: NIPD (NIS lokal) atau NISN. Kalau keduanya kosong,
      // pakai peserta_didik_id sebagai fallback.
      const nis = pd.nipd?.trim() || pd.nisn?.trim() || pd.peserta_didik_id;
      siswaKeys.add(nis);

      const classId =
        (pd.rombongan_belajar_id && classByRombelId.get(pd.rombongan_belajar_id)) ||
        (pd.nama_rombel && classByName.get(pd.nama_rombel.toLowerCase())) ||
        null;

      if (!classId) {
        counts.siswa.error++;
        errors.push(
          `Siswa "${pd.nama}" (${nis}): rombel "${pd.nama_rombel ?? "-"}" tidak ditemukan`
        );
        continue;
      }

      // Match by NIS ATAU NISN — DB hasil impor lama kadang menyimpan NISN
      // sebagai nis ketika NIPD kosong. Kalau hanya match by NIPD, siswa
      // yang sama akan di-create ulang (duplikat) dan versi lama di-archive.
      const existing = await db.student.findFirst({
        where: {
          OR: [
            { nis },
            ...(pd.nisn?.trim() ? [{ nisn: pd.nisn.trim() }] : []),
          ],
        },
      });

      const dataForWrite = {
        // Pertahankan nis lama bila siswa sudah ada (hindari bentrok unique).
        nis: existing?.nis ?? nis,
        nisn: pd.nisn?.trim() || null,
        name: pd.nama,
        gender: mapGender(pd.jenis_kelamin),
        address: pd.alamat_jalan?.trim() || null,
        parentName: pd.nama_ayah ? [pd.nama_ayah, pd.nama_ibu].filter(Boolean).join(" / ") : null,
        classId,
        isActive: true,
      };

      if (existing) {
        // Kalau match via NISN, pastikan NIS lama juga dianggap ada di Dapodik
        // supaya tidak ter-archive (duplikat semu).
        siswaKeys.add(existing.nis);
        if (!dryRun) {
          await db.student.update({ where: { id: existing.id }, data: dataForWrite });
        }
        counts.siswa.update++;
      } else {
        if (!dryRun) {
          await db.student.create({ data: dataForWrite });
        }
        counts.siswa.create++;
      }
    } catch (e) {
      counts.siswa.error++;
      errors.push(`Siswa "${pd.nama}": ${e instanceof Error ? e.message : "gagal"}`);
    }
  }

  // Siswa di CMS yang tidak muncul di data Dapodik semester ini -> nonaktifkan
  // (kalau memang tidak lagi terdaftar). Hanya untuk siswa yang kelasnya
  // ikut ter-sync dari Dapodik, supaya tidak menyentuh data manual.
  if (!dryRun && classByName.size > 0) {
    const classIds = [...new Set(classByName.values())];
    const dbStudents = await db.student.findMany({
      where: { classId: { in: classIds }, isActive: true },
      select: { id: true, nis: true },
    });
    const toArchive = dbStudents.filter((s) => !siswaKeys.has(s.nis));
    if (toArchive.length > 0) {
      await db.student.updateMany({
        where: { id: { in: toArchive.map((s) => s.id) } },
        data: { isActive: false },
      });
    }
    counts.siswa.archived = toArchive.length;
  } else {
    counts.siswa.archived = 0;
  }

  // --- GTK -> Teacher ------------------------------------------------------
  for (const gtk of data.gtk) {
    try {
      const position = gtk.jenis_ptk_id_str?.trim() || gtk.jabatan?.trim() || "Guru";
      const nuptk = gtk.nuptk?.trim() || null;
      const nip = gtk.nip?.trim() || null;

      // Identitas akurat dulu: cocokkan NUPTK/NIP GTK ke NUPTK/NIP yang
      // tersimpan di database (unik per orang). Fallback ke nama di bawah.
      const identifierMatch = await (async () => {
        if (nuptk) {
          const byNuptk = await db.teacher.findFirst({ where: { nuptk } });
          if (byNuptk) return byNuptk;
        }
        if (nip) {
          const byNip = await db.teacher.findFirst({ where: { nip } });
          if (byNip) return byNip;
        }
        return null;
      })();

      const nameMatches = await db.teacher.findMany({
        where: { name: gtk.nama },
      });
      const target = resolveGtkTarget({
        identifierMatch,
        nameMatches,
        nuptk,
        nip,
        name: gtk.nama,
      });

      if (target.action === "skip") {
        counts.gtk.error++;
        errors.push(target.reason);
        continue;
      }

      // NUPTK/NIP ikut disimpan agar sinkronisasi berikutnya bisa match lebih
      // akurat (bukan hanya by nama).
      //
      // PENTING: pertahankan NUPTK/NIP lama bila data GTK tidak menyediakannya
      // (Dapodik bisa tidak konsisten antar sync). Tanpa ini, guru yang cocok
      // via NUPTK tapi tanpa NIP di data GTK akan kehilangan NIP tersimpan.
      const existingForUpdate =
        target.action === "update"
          ? identifierMatch?.id === target.id
            ? identifierMatch
            : (nameMatches.find((m) => m.id === target.id) ?? null)
          : null;
      const dataForWrite = {
        name: gtk.nama,
        position,
        nuptk: nuptk ?? existingForUpdate?.nuptk ?? null,
        nip: nip ?? existingForUpdate?.nip ?? null,
        isActive: true,
      };
      if (target.action === "update") {
        if (!dryRun) {
          await db.teacher.update({ where: { id: target.id }, data: dataForWrite });
        }
        counts.gtk.update++;
      } else {
        if (!dryRun) {
          await db.teacher.create({ data: dataForWrite });
        }
        counts.gtk.create++;
      }
    } catch (e) {
      counts.gtk.error++;
      errors.push(`GTK "${gtk.nama}": ${e instanceof Error ? e.message : "gagal"}`);
    }
  }

  // Catat waktu sinkronisasi terakhir (tidak pada dry-run).
  if (!dryRun) {
    await db.dapodikConfig.update({
      where: { id: "singleton" },
      data: {
        lastSyncAt: new Date(),
        lastSyncBy: byUser?.name ?? null,
      },
    });
  }

  return {
    counts,
    sekolah: data.sekolah,
    semesterId: semesterId ?? null,
    errors,
  };
}
