import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const search = searchParams.get("search");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(1000, Math.max(1, Number(searchParams.get("limit") || "50")));

  const where: Record<string, unknown> = {};
  if (classId) where.classId = classId;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { nis: { contains: search } },
      { nisn: { contains: search } },
    ];
  }

  const [total, items] = await Promise.all([
    db.student.count({ where }),
    db.student.findMany({
      where,
      include: { class: { select: { name: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    items: items.map((s) => ({
      ...s,
      className: s.class?.name ?? "—",
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const nis = String(body.nis ?? "").trim();
  const name = String(body.name ?? "").trim();
  const classId = String(body.classId ?? "").trim();

  if (!nis || !name || !classId) {
    return NextResponse.json(
      { error: "NIS, nama, dan kelas wajib diisi." },
      { status: 400 }
    );
  }

  const exists = await db.student.findUnique({ where: { nis } });
  if (exists) {
    return NextResponse.json({ error: "NIS sudah terdaftar." }, { status: 409 });
  }

  const classExists = await db.class.findUnique({ where: { id: classId } });
  if (!classExists) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const item = await db.student.create({
    data: {
      nis,
      nisn: body.nisn || null,
      name,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      gender: body.gender || null,
      address: body.address || null,
      phone: body.phone || null,
      email: body.email || null,
      parentName: body.parentName || null,
      parentPhone: body.parentPhone || null,
      classId,
    },
  });

  await logActivity(auth.user, "CREATE", "Student", `Menambah siswa: ${name} (${nis})`, item.id);
  return NextResponse.json(item);
}
