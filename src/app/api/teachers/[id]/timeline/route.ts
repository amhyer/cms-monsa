import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * GET /api/teachers/[id]/timeline
 * Public: get achievement timeline for a teacher
 * Uses TeacherSection with specific icons as timeline items
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Get teacher sections that look like timeline items
    // (certifications, achievements, training)
    const sections = await db.teacherSection.findMany({
      where: {
        teacherId: id,
        isVisible: true,
        OR: [
          { title: { contains: "Sertifikasi" } },
          { title: { contains: "Prestasi" } },
          { title: { contains: "Pelatihan" } },
          { title: { contains: "Training" } },
          { title: { contains: "Award" } },
          { icon: "🏆" },
          { icon: "🎓" },
          { icon: "📜" },
          { icon: "🏅" },
          { icon: "⭐" },
        ],
      },
      orderBy: { order: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        icon: true,
        createdAt: true,
      },
    });

    // Transform sections into timeline items
    const items = sections.map((section) => {
      // Determine type based on title or icon
      let type: "achievement" | "certification" | "training" | "other" = "other";
      const titleLower = section.title.toLowerCase();
      
      if (titleLower.includes("sertifikasi") || section.icon === "📜") {
        type = "certification";
      } else if (titleLower.includes("prestasi") || titleLower.includes("penghargaan") || section.icon === "🏆" || section.icon === "🏅") {
        type = "achievement";
      } else if (titleLower.includes("pelatihan") || titleLower.includes("training") || section.icon === "🎓") {
        type = "training";
      }

      return {
        id: section.id,
        title: section.title,
        description: section.content,
        date: section.createdAt.toISOString(),
        type,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    logger.error({ err: e }, "[teacher-timeline] GET error");
    return NextResponse.json(
      { error: "Gagal memuat linimasa." },
      { status: 500 }
    );
  }
}
