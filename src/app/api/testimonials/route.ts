import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    console.error("[testimonials] GET error:", e);
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
  try {
    const body = await req.json();
    const { parentName, studentName, className, relation, content, rating, photoUrl } = body;

    // Validate required fields
    if (!parentName?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Nama dan testimoni wajib diisi." },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating harus antara 1-5." },
        { status: 400 }
      );
    }

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
    console.error("[testimonials] POST error:", e);
    return NextResponse.json(
      { error: "Gagal mengirim testimoni." },
      { status: 500 }
    );
  }
}
