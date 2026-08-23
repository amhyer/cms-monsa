import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/albums
 * Public: get gallery albums
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    const albums = await db.album.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        coverUrl: true,
        category: true,
        createdAt: true,
        _count: {
          select: { photos: true },
        },
      },
    });

    // Get categories with counts
    const categories = await db.album.groupBy({
      by: ["category"],
      where: { isPublished: true },
      _count: { id: true },
    });

    return NextResponse.json({
      albums: albums.map((a) => ({
        ...a,
        photoCount: a._count.photos,
        _count: undefined,
      })),
      categories: categories.map((c) => ({
        name: c.category,
        count: c._count.id,
      })),
    });
  } catch (e) {
    console.error("[albums] GET error:", e);
    return NextResponse.json(
      { error: "Gagal memuat album." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/albums
 * Admin: create album
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, coverUrl, category, sortOrder } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Nama album wajib diisi." },
        { status: 400 }
      );
    }

    // Create album
    const album = await db.album.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        coverUrl: coverUrl?.trim() || null,
        category: category || "Kegiatan",
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json(album, { status: 201 });
  } catch (e) {
    console.error("[albums] POST error:", e);
    return NextResponse.json(
      { error: "Gagal membuat album." },
      { status: 500 }
    );
  }
}
