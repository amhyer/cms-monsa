import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

type BulkStudent = {
  nis: string;
  name: string;
  classId: string;
  nisn?: string | null;
  gender?: string | null;
  parentName?: string | null;
};

const MAX_RECORDS = 500;

/**
 * Import/update siswa secara massal (upsert by NIS).
 * Body: { items: [{ nis, name, classId, nisn?, gender?, parentName? }] }
 * Response: { created, updated, skipped, errors: [{ row, error }] }
 */
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const items: BulkStudent[] = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data siswa yang dikirim." },
      { status: 400 }
    );
  }
  if (items.length > MAX_RECORDS) {
    return NextResponse.json(
      { error: `Terlalu banyak data dalam satu request (maks. ${MAX_RECORDS}).` },
      { status: 400 }
    );
  }

  // Validasi awal per baris, kumpulkan error tanpa membatalkan seluruhnya.
  const errors: { row: number; error: string }[] = [];
  const valid: (BulkStudent & { row: number })[] = [];
  items.forEach((it, idx) => {
    const row = idx + 2; // baris ke-2 dst (baris 1 = header)
    const nis = String(it.nis ?? "").trim();
    const name = String(it.name ?? "").trim();
    const classId = String(it.classId ?? "").trim();
    if (!nis || !name || !classId) {
      errors.push({ row, error: "NIS, nama, dan kelas wajib diisi." });
      return;
    }
    if (!["LAKI_LAKI", "PEREMPUAN"].includes(String(it.gender ?? "")) && it.gender) {
      errors.push({ row, error: "Jenis kelamin harus LAKI_LAKI atau PEREMPUAN." });
      return;
    }
    valid.push({ ...it, nis, name, classId, row });
  });

  // Pastikan semua kelas yang dirujuk ada.
  const classIds = [...new Set(valid.map((v) => v.classId))];
  const classes = await db.class.findMany({
    where: { id: { in: classIds } },
    select: { id: true },
  });
  const validClassIds = new Set(classes.map((c) => c.id));
  // O(n) — sebelumnya `valid.splice(valid.indexOf(v), 1)` di dalam loop, O(n²).
  const rows = valid.filter((v) => {
    if (validClassIds.has(v.classId)) return true;
    errors.push({ row: v.row, error: `Kelas "${v.classId}" tidak ditemukan.` });
    return false;
  });

  // NIS duplikat dalam satu payload: pertahankan kemunculan TERAKHIR dan
  // laporkan baris yang digantikan. Tanpa ini, dua `create` dengan NIS sama di
  // dalam satu transaksi akan melanggar unique constraint dan me-rollback
  // SELURUH import. Last-write-wins dipilih agar setara dengan perilaku lama
  // (baris pertama create, baris duplikat kemudian meng-update-nya).
  const byNis = new Map<string, (typeof rows)[number]>();
  for (const v of rows) {
    const prev = byNis.get(v.nis);
    if (prev) {
      errors.push({
        row: prev.row,
        error: `NIS "${v.nis}" muncul lagi di baris ${v.row}. Baris ini diabaikan karena digantikan.`,
      });
    }
    byNis.set(v.nis, v);
  }
  const deduped = [...byNis.values()];

  // Ambil semua kandidat dalam SATU query (temuan review M4).
  // Sebelumnya: satu `findUnique` per baris → N query, lalu satu tulis per
  // baris → total 2N round-trip SEKUENSIAL. Untuk 500 baris itu 1000 query ke
  // Neon yang bisa memakan puluhan detik dan menembus batas fungsi.
  const nisList = [...byNis.keys()];
  const existingStudents = nisList.length
    ? await db.student.findMany({
        where: { nis: { in: nisList } },
        select: { id: true, nis: true, nisn: true, gender: true, parentName: true },
      })
    : [];
  const existingByNis = new Map(existingStudents.map((s) => [s.nis, s]));

  // Semua tulis dibungkus SATU transaksi array — pola yang sama dengan
  // /api/attendances/bulk. Import kini atomik: kegagalan di baris ke-300
  // tidak lagi menyisakan 299 baris yang sudah tertulis tanpa rollback.
  const ops = deduped.map((v) => {
    const existing = existingByNis.get(v.nis);
    if (existing) {
      return db.student.update({
        where: { id: existing.id },
        data: {
          name: v.name,
          classId: v.classId,
          nisn: v.nisn ?? existing.nisn,
          gender: v.gender ?? existing.gender,
          parentName: v.parentName ?? existing.parentName,
        },
      });
    }
    return db.student.create({
      data: {
        nis: v.nis,
        name: v.name,
        classId: v.classId,
        nisn: v.nisn || null,
        gender: v.gender || null,
        parentName: v.parentName || null,
      },
    });
  });

  let created = 0;
  let updated = 0;
  if (ops.length > 0) {
    // Tanpa opsi timeout: bentuk ARRAY dari $transaction hanya menerima
    // { isolationLevel }. maxWait/timeout adalah opsi bentuk interaktif
    // (callback) — lihat DAPODIK_TX_OPTIONS di dapodik-sync.ts. Sama seperti
    // /api/attendances/bulk yang juga memakai bentuk array tanpa opsi.
    await db.$transaction(ops);
    for (const v of deduped) {
      if (existingByNis.has(v.nis)) updated++;
      else created++;
    }
  }

  if (created > 0 || updated > 0) {
    await logActivity(
      auth.user,
      "CREATE",
      "Student",
      `Import CSV: ${created} siswa baru, ${updated} diperbarui (${errors.length} gagal)`,
      "-"
    );
  }

  return NextResponse.json({ ok: true, created, updated, errors });
}
