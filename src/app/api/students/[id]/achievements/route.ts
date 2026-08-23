import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/students/[id]/achievements
 * Public: get student achievements
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      studentId: id,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    const achievements = await db.studentAchievement.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        level: true,
        date: true,
        certificate: true,
        issuedBy: true,
      },
    });

    // Get stats
    const stats = await db.studentAchievement.groupBy({
      by: ["category"],
      where: { studentId: id, isActive: true },
      _count: { id: true },
    });

    return NextResponse.json({
      achievements,
      stats: stats.map((s) => ({
        category: s.category,
        count: s._count.id,
      })),
      total: achievements.length,
    });
  } catch (e) {
    console.error("[student-achievements] GET error:", e);
    return NextResponse.json(
      { error: "Gagal memuat prestasi siswa." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students/[id]/achievements
 * Admin: create student achievement
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, category, level, date, certificate, issuedBy } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Judul prestasi wajib diisi." },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: "Tanggal prestasi wajib diisi." },
        { status: 400 }
      );
    }

    // Verify student exists
    const student = await db.student.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Siswa tidak ditemukan." },
        { status: 404 }
      );
    }

    // Create achievement
    const achievement = await db.studentAchievement.create({
      data: {
        studentId: id,
        title: title.trim(),
        description: description?.trim() || null,
        category: category || "Akademik",
        level: level || "Sekolah",
        date: new Date(date),
        certificate: certificate?.trim() || null,
        issuedBy: issuedBy?.trim() || null,
      },
    });

    return NextResponse.json(achievement, { status: 201 });
  } catch (e) {
    console.error("[student-achievements] POST error:", e);
    return NextResponse.json(
      { error: "Gagal menambah prestasi." },
      { status: 500 }
    );
  }
}
