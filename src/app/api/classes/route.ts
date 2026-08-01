import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "public";
  const grade = searchParams.get("grade");
  const academicYear = searchParams.get("academicYear");

  if (scope === "admin") {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const where: Record<string, unknown> = {};
    if (grade && grade !== "all") where.grade = grade;
    if (academicYear) where.academicYear = academicYear;

    const items = await db.class.findMany({
      where,
      include: {
        homeroomTeacher: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      items: items.map((c) => ({
        ...c,
        studentCount: c._count.students,
        homeroomTeacherName: c.homeroomTeacher?.name ?? "—",
      })),
    });
  }

  // Public: only active classes
  const where = { isActive: true, ...(grade && grade !== "all" ? { grade } : {}) };
  const items = await db.class.findMany({
    where,
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const grade = String(body.grade ?? "").trim();
  const academicYear = String(body.academicYear ?? "").trim();

  if (!name || !grade || !academicYear) {
    return NextResponse.json(
      { error: "Nama kelas, grade, dan tahun ajaran wajib diisi." },
      { status: 400 }
    );
  }

  const exists = await db.class.findUnique({ where: { name } });
  if (exists) {
    return NextResponse.json({ error: "Nama kelas sudah ada." }, { status: 409 });
  }

  const item = await db.class.create({
    data: {
      name,
      grade,
      stream: body.stream || null,
      academicYear,
      homeroomTeacherId: body.homeroomTeacherId || null,
    },
  });

  await logActivity(auth.user, "CREATE", "Class", `Menambah kelas: ${name}`, item.id);
  return NextResponse.json(item);
}
