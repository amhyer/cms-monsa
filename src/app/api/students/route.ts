import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import {
  createStudentSchema,
  validateBody,
} from "@/lib/validations";
import { logActivity } from "@/lib/log";
import {
  parsePaginationParams,
  decodeCursor,
  buildPaginatedResponse,
} from "@/lib/pagination";

export async function GET(req: NextRequest) {
  const auth = await requireRole("GURU");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const { cursor, limit } = parsePaginationParams(searchParams, 50, 1000);
  const cursorId = decodeCursor(cursor);
  const classId = searchParams.get("classId");
  const search = searchParams.get("search");

  const baseWhere: Record<string, unknown> = {};
  if (classId) baseWhere.classId = classId;
  if (search) {
    baseWhere.OR = [
      { name: { contains: search } },
      { nis: { contains: search } },
      { nisn: { contains: search } },
      { parentName: { contains: search } },
    ];
  }

  const where = {
    ...baseWhere,
    // Cursor-based: fetch items after the cursor
    ...(cursorId ? { id: { gt: cursorId } } : {}),
  };

  const [total, items] = await Promise.all([
    db.student.count({ where: baseWhere }),
    db.student.findMany({
      where,
      include: { class: { select: { name: true } } },
      orderBy: { id: "asc" }, // Use id for consistent cursor ordering
      take: limit + 1, // Fetch one extra to determine if there's more
    }),
  ]);

  return NextResponse.json(
    buildPaginatedResponse(
      items.map((s) => ({ ...s, className: s.class?.name ?? "—" })),
      total,
      limit
    )
  );
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
