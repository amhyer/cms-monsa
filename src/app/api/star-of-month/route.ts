import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCsrf } from "@/lib/csrf";
import { requireRole } from "@/lib/auth";
import { createStarOfMonthSchema, validateBody } from "@/lib/validations";

/**
 * GET /api/star-of-month
 * Public: get star of the month
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // STUDENT | TEACHER
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const now = new Date();
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const where: Record<string, unknown> = {
      isActive: true,
      month: targetMonth,
      year: targetYear,
    };

    if (type) {
      where.type = type;
    }

    const stars = await db.starOfMonth.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            class: { select: { name: true } },
          },
        },
        teacher: {
          select: {
            id: true,
            name: true,
            photo: true,
            position: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ stars });
  } catch (e) {
    console.error("[star-of-month] GET error:", e);
    return NextResponse.json(
      { error: "Gagal memuat bintang bulanan." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/star-of-month
 * Admin: create star of the month
 */
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const validation = validateBody(createStarOfMonthSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { type, month, year, studentId, teacherId, reason, achievement, photoUrl } = validation.data;

    // Check if already exists
    const existing = await db.starOfMonth.findUnique({
      where: { type_month_year: { type, month, year } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bintang bulanan untuk bulan ini sudah ada." },
        { status: 400 }
      );
    }

    // Create star of the month
    const star = await db.starOfMonth.create({
      data: {
        type,
        month,
        year,
        studentId: type === "STUDENT" ? studentId : null,
        teacherId: type === "TEACHER" ? teacherId : null,
        reason: reason.trim(),
        achievement: achievement?.trim() || null,
        photoUrl: photoUrl?.trim() || null,
      },
    });

    return NextResponse.json(star, { status: 201 });
  } catch (e) {
    console.error("[star-of-month] POST error:", e);
    return NextResponse.json(
      { error: "Gagal menambah bintang bulanan." },
      { status: 500 }
    );
  }
}
