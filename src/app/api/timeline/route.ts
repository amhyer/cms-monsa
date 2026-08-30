import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * GET /api/timeline
 * Public: get school timeline
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const category = searchParams.get("category");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    if (year) {
      where.year = parseInt(year);
    }

    const timeline = await db.schoolTimeline.findMany({
      where,
      orderBy: [{ year: "desc" }, { sortOrder: "asc" }],
      take: limit,
      select: {
        id: true,
        year: true,
        month: true,
        title: true,
        description: true,
        imageUrl: true,
        category: true,
      },
    });

    // Group by year
    const groupedByYear: Record<number, typeof timeline> = {};
    timeline.forEach((item) => {
      if (!groupedByYear[item.year]) {
        groupedByYear[item.year] = [];
      }
      groupedByYear[item.year].push(item);
    });

    // Get categories
    const categories = await db.schoolTimeline.groupBy({
      by: ["category"],
      where: { isPublished: true },
      _count: { id: true },
    });

    return NextResponse.json({
      timeline,
      groupedByYear,
      categories: categories.map((c) => ({
        name: c.category,
        count: c._count.id,
      })),
    });
  } catch (e) {
    logger.error({ err: e }, "[timeline] GET error");
    return NextResponse.json(
      { error: "Gagal memuat timeline." },
      { status: 500 }
    );
  }
}
