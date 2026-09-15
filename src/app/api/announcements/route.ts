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
    // scope=admin → dashboard management list: semua status (termasuk draft),
    // tanpa filter kedaluwarsa, dan `items` memuat isActive. Scope ini butuh
    // sesi OPERATOR karena mengekspos draft; tanpa scope → list publik yang
    // hanya berisi published + belum kedaluwarsa.
    const isAdminScope = searchParams.get("scope") === "admin";

    const where: Record<string, unknown> = {
      isPublished: true,
    };
    if (isAdminScope) {
      const auth = await requireRole("OPERATOR");
      if (!auth.ok) return auth.response;
      delete where.isPublished;
    }

    if (category) {
      where.category = category;
    }

    if (pinned) {
      where.isPinned = true;
    }

    // Filter expired announcements (publik saja — admin melihat semuanya)
    if (!isAdminScope) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ];
    }

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
        isPublished: true,
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
      // `items` adalah kontrak SEMUA consumer (manager dashboard + ticker
      // berjalan publik) — selalu ada, dengan isActive dipetakan dari kolom
      // isPublished. scope=admin hanya melebarkan baris (draft tanpa filter
      // kedaluwarsa), bukan bentuk respons.
      items: announcements.map((a) => ({
        ...a,
        isActive: a.isPublished,
      })),
      // `announcements` dipertahankan untuk kompatibilitas
      // dengan announcement-system dan test unit lama.
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
      isActive,
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
        // Kontrak dashboard manager memakai isActive; kolom DB adalah
        // isPublished. Default true supaya API tunggal (title+content)
        // tetap membuat pengumuman yang langsung tayang.
        isPublished: isActive !== undefined ? Boolean(isActive) : true,
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
