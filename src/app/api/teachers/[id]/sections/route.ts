import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withCache } from "@/lib/cache";

/**
 * GET /api/teachers/[id]/sections
 * Public endpoint to get visible sections for a teacher
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sections = await db.teacherSection.findMany({
      where: {
        teacherId: id,
        isVisible: true,
      },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        content: true,
        icon: true,
        order: true,
        isVisible: true,
      },
    });

    return withCache(
      NextResponse.json(sections),
      "public, s-maxage=300, stale-while-revalidate=600"
    );
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat bagian profil." },
      { status: 500 }
    );
  }
}
