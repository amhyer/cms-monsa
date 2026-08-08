import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import {
  createStudentSchema,
  validateBody,
} from "@/lib/validations";
import { logActivity } from "@/lib/log";

export async function GET(req: NextRequest) {
  const auth = await requireRole("GURU");
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
  const validation = validateBody(createStudentSchema, body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { nis, name, classId } = validation.data;

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
      ...validation.data,
      dateOfBirth: validation.data.dateOfBirth
        ? new Date(validation.data.dateOfBirth)
        : null,
    },
  });

  await logActivity(auth.user, "CREATE", "Student", `Menambah siswa: ${name} (${nis})`, item.id);
  return NextResponse.json(item);
}
