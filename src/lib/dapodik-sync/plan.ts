// Lapisan orkestrasi sync Dapodik (tarik payload + simulasi dry-run +
// memanggil commit) — diekstrak dari dapodik-sync.ts (P2-2).
import { db } from "@/lib/db";
import { getDapodikClient } from "@/lib/dapodik-config";
import {
  currentAcademicYear,
  normalize,
  resolveNis,
} from "@/lib/dapodik-sync-helpers";
import { commitDapodikPayload } from "./commit";
import { normalizeDapodikPayload } from "./normalize";
import type {
  CommitResult,
  DapodikPayload,
  DapodikSekolah,
  DryRunResult,
  SyncResult,
} from "./types";

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
  // Payload bisa override (dipakai saat kirim chunk parsial dari script
  // Python — lihat docs/SYNC-DAPODIK-PYTHON.md).
  const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  const archiveUnlisted =
    payload.archiveUnlisted ?? cfg?.archiveUnlisted !== false;

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

  // Payload parsial (dataType: gtk/rombel/peserta_didik) tidak membawa info
  // sekolah — sekolah.updated = 0 dan siteSetting tidak disentuh.
  const hasSchool = !!normalize(sekolah.nama) && !!normalize(sekolah.npsn);

  const result: SyncResult = {
    sekolah: { updated: hasSchool ? 1 : 0 },
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
      // Payload parsial tidak membawa sekolah — jangan timpa npsn yang ada.
      ...(hasSchool ? { npsn: sekolah.npsn } : {}),
    },
  });

  return { ...result, mode: "commit", logId: log.id };
}
