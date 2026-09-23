import { safeJson, withErrorHandling } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCsrf } from "@/lib/csrf";
import { requireRole } from "@/lib/auth";
import { createStarOfMonthSchema, validateBody } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * GET /api/star-of-month
 * Public: get star of the month
 */
async function GET_impl(req: NextRequest) {
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
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const GET = withErrorHandling(GET_impl, { errorMessage: "Gagal memuat bintang bulanan." });

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
    const parsed = await safeJson(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
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
    logger.error({ err: e }, "[star-of-month] POST error");
    return NextResponse.json(
      { error: "Gagal menambah bintang bulanan." },
      { status: 500 }
    );
  }
}
