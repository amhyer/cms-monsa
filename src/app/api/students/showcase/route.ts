import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Galeri siswa publik (beranda): hanya siswa aktif, proyeksi aman tanpa
// data pribadi (NIS/NISN, kontak, orang tua) — cukup untuk orang tua
// mencari & melihat foto anaknya.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const classId = searchParams.get("classId");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "60")));

  const where: Record<string, unknown> = { isActive: true };
  if (classId) where.classId = classId;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { nis: { contains: q } },
      { nisn: { contains: q } },
    ];
  }

  const [total, items] = await Promise.all([
    db.student.count({ where }),
    db.student.findMany({
      where,
      include: { class: { select: { name: true } } },
      orderBy: [{ class: { grade: "asc" } }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    items: items.map((s) => ({
      id: s.id,
      name: s.name,
      photoUrl: s.photoUrl,
      className: s.class?.name ?? "—",
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}