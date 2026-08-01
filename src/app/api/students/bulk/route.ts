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
  for (const v of [...valid]) {
    if (!validClassIds.has(v.classId)) {
      errors.push({ row: v.row, error: `Kelas "${v.classId}" tidak ditemukan.` });
      valid.splice(valid.indexOf(v), 1);
    }
  }

  let created = 0;
  let updated = 0;
  for (const v of valid) {
    const existing = await db.student.findUnique({ where: { nis: v.nis } });
    if (existing) {
      await db.student.update({
        where: { id: existing.id },
        data: {
          name: v.name,
          classId: v.classId,
          nisn: v.nisn ?? existing.nisn,
          gender: v.gender ?? existing.gender,
          parentName: v.parentName ?? existing.parentName,
        },
      });
      updated++;
    } else {
      await db.student.create({
        data: {
          nis: v.nis,
          name: v.name,
          classId: v.classId,
          nisn: v.nisn || null,
          gender: v.gender || null,
          parentName: v.parentName || null,
        },
      });
      created++;
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
