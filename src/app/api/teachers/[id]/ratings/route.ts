import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimitPublicForm } from "@/lib/rate-limit";
import { createTeacherRatingSchema, validateBody } from "@/lib/validations";

/**
 * GET /api/teachers/[id]/ratings
 * Public: get approved ratings for a teacher
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const ratings = await db.teacherRating.findMany({
      where: {
        teacherId: id,
        isApproved: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        rating: true,
        comment: true,
        authorName: true,
        createdAt: true,
      },
    });

    // Calculate average rating
    const stats = await db.teacherRating.aggregate({
      where: {
        teacherId: id,
        isApproved: true,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return NextResponse.json({
      ratings,
      averageRating: stats._avg.rating || 0,
      totalRatings: stats._count.rating || 0,
    });
  } catch (e) {
    console.error("[teacher-ratings] GET error:", e);
    return NextResponse.json(
      { error: "Gagal memuat rating." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teachers/[id]/ratings
 * Public: submit a rating (requires auth or anonymous)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = await rateLimitPublicForm(req);
  if (rateLimited) return rateLimited;

  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(createTeacherRatingSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { rating, comment, authorName } = validation.data;

    // Validate teacher exists
    const teacher = await db.teacher.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!teacher || !teacher.isActive) {
      return NextResponse.json(
        { error: "Guru tidak ditemukan." },
        { status: 404 }
      );
    }

    // Create rating (needs admin approval)
    const newRating = await db.teacherRating.create({
      data: {
        teacherId: id,
        rating: Math.round(rating),
        comment: comment?.trim() || null,
        authorName: authorName?.trim() || "Anonim",
        isApproved: false, // Needs admin approval
      },
    });

    return NextResponse.json(
      {
        message: "Terima kasih! Rating Anda akan tampil setelah disetujui admin.",
        id: newRating.id,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[teacher-ratings] POST error:", e);
    return NextResponse.json(
      { error: "Gagal mengirim rating." },
      { status: 500 }
    );
  }
}
