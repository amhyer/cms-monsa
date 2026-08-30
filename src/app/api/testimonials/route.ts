import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimitPublicForm } from "@/lib/rate-limit";
import { createTestimonialSchema, validateBody } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * GET /api/testimonials
 * Public: get published testimonials
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const testimonials = await db.parentTestimonial.findMany({
      where: {
        isPublished: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        parentName: true,
        studentName: true,
        className: true,
        relation: true,
        content: true,
        rating: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    // Get average rating
    const stats = await db.parentTestimonial.aggregate({
      where: { isPublished: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    return NextResponse.json({
      testimonials,
      averageRating: stats._avg.rating || 0,
      total: stats._count.id || 0,
    });
  } catch (e) {
    logger.error({ err: e }, "[testimonials] GET error");
    return NextResponse.json(
      { error: "Gagal memuat testimoni." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/testimonials
 * Public: submit a testimonial
 */
export async function POST(req: NextRequest) {
  const rateLimited = await rateLimitPublicForm(req);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const validation = validateBody(createTestimonialSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { parentName, studentName, className, relation, content, rating, photoUrl } = validation.data;

    // Create testimonial
    const testimonial = await db.parentTestimonial.create({
      data: {
        parentName: parentName.trim(),
        studentName: studentName?.trim() || null,
        className: className?.trim() || null,
        relation: relation?.trim() || null,
        content: content.trim(),
        rating: Math.round(rating),
        photoUrl: photoUrl?.trim() || null,
        isApproved: false,
        isPublished: false,
      },
    });

    return NextResponse.json(
      {
        message: "Terima kasih! Testimoni Anda akan tampil setelah disetujui admin.",
        id: testimonial.id,
      },
      { status: 201 }
    );
  } catch (e) {
    logger.error({ err: e }, "[testimonials] POST error");
    return NextResponse.json(
      { error: "Gagal mengirim testimoni." },
      { status: 500 }
    );
  }
}
