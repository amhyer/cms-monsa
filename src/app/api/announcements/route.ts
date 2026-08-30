import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCsrf } from "@/lib/csrf";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/announcements
 * Public: get school announcements
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const category = searchParams.get("category");
    const pinned = searchParams.get("pinned") === "true";

    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    if (pinned) {
      where.isPinned = true;
    }

    // Filter expired announcements
    where.OR = [
      { expiresAt: null },
      { expiresAt: { gte: new Date() } },
    ];

    const announcements = await db.schoolAnnouncement.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        summary: true,
        category: true,
        priority: true,
        imageUrl: true,
        isPinned: true,
        publishedAt: true,
        expiresAt: true,
        viewCount: true,
        targetAudience: true,
        createdAt: true,
      },
    });

    // Get categories with counts
    const categories = await db.schoolAnnouncement.groupBy({
      by: ["category"],
      where: { isPublished: true },
      _count: { id: true },
    });

    return NextResponse.json({
      announcements,
      categories: categories.map((c) => ({
        name: c.category,
        count: c._count.id,
      })),
    });
  } catch (e) {
    logger.error({ err: e }, "[announcements] GET error");
    return NextResponse.json(
      { error: "Gagal memuat pengumuman." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 * Admin: create announcement
 */
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      title,
      content,
      summary,
      category,
      priority,
      imageUrl,
      isPinned,
      expiresAt,
      targetAudience,
      publishedAt,
    } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Judul pengumuman wajib diisi." },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Isi pengumuman wajib diisi." },
        { status: 400 }
      );
    }

    // Create announcement
    const announcement = await db.schoolAnnouncement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        summary: summary?.trim() || null,
        category: category || "Info",
        priority: priority || "NORMAL",
        imageUrl: imageUrl?.trim() || null,
        isPinned: isPinned || false,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        targetAudience: targetAudience || "ALL",
      },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "[announcements] POST error");
    return NextResponse.json(
      { error: "Gagal membuat pengumuman." },
      { status: 500 }
    );
  }
}
