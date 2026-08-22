import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { logger } from "@/lib/logger";
import { omitFields } from "@/lib/utils";
import { PUBLIC_TEACHER_OMIT } from "@/lib/public-scope";
import { createTeacherSchema, validateBody, teacherProfileData } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "public";
    // scope=admin returns ALL teachers (incl. inactive) — requires auth.
    // Dukungan pagination server-side (page/limit) + pencarian (q) mengikuti
    // pola /api/users: manager tidak lagi memuat seluruh daftar sekaligus.
    if (scope === "admin") {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
      const page = Math.max(1, Number(searchParams.get("page") || "1"));
      const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || "10")));
      const q = searchParams.get("q")?.trim() || "";
      const where = q
        ? {
            OR: [
              { name: { contains: q } },
              { position: { contains: q } },
              { subject: { contains: q } },
            ],
          }
        : {};
      const [total, items] = await Promise.all([
        db.teacher.count({ where }),
        db.teacher.findMany({
          where,
          include: { homeroomClasses: { select: { id: true, name: true } } },
          orderBy: [{ order: "asc" }, { name: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      return NextResponse.json({
        items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    }
    // public: only active teachers.
    // Identitas (NUPTK/NIP/NIK) tidak pernah keluar dari scope admin.
    const items = await db.teacher.findMany({
      where: { isActive: true },
      include: { homeroomClasses: { select: { id: true, name: true } } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({
      items: items.map((t) => omitFields(t, PUBLIC_TEACHER_OMIT)),
    });
  } catch (error) {
    logger.error({ err: error }, "[teachers] GET error");
    return NextResponse.json(
      { items: [], error: "Gagal memuat data guru/staf." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createTeacherSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, subject, imageUrl, order } = validation.data;
  const count = await db.teacher.count();
  const item = await db.teacher.create({
    data: {
      name,
      position: body.position || "",
      subject: subject || null,
      photo: imageUrl || null,
      order: order ?? count,
      isActive: body.isActive !== false,
      ...teacherProfileData(body),
    },
  });
  await logActivity(auth.user, "CREATE", "Teacher", `Menambah data guru/staf: ${name}`, item.id);
  return NextResponse.json(item);
}
