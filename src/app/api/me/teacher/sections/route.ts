import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { logger } from "@/lib/logger";

/**
 * GET /api/me/teacher/sections
 * Get all sections for the current teacher
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Find teacher linked to this user
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { teacherId: true },
    });

    if (!user?.teacherId) {
      return NextResponse.json(
        { error: "Akun Anda belum tertaut ke data guru." },
        { status: 404 }
      );
    }

    const sections = await db.teacherSection.findMany({
      where: { teacherId: user.teacherId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(sections);
  } catch (e) {
    logger.error({ err: e }, "[teacher-sections] GET error");
    return NextResponse.json(
      { error: "Gagal memuat bagian profil." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/me/teacher/sections
 * Create a new section for the current teacher
 */
export async function POST(req: NextRequest) {
  try {
    const csrfError = await requireCsrf(req);
    if (csrfError) return csrfError;

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Find teacher linked to this user
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { teacherId: true },
    });

    if (!user?.teacherId) {
      return NextResponse.json(
        { error: "Akun Anda belum tertaut ke data guru." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { title, content, icon } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Judul bagian wajib diisi." },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Isi bagian wajib diisi." },
        { status: 400 }
      );
    }

    // Get the current max order
    const lastSection = await db.teacherSection.findFirst({
      where: { teacherId: user.teacherId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const section = await db.teacherSection.create({
      data: {
        teacherId: user.teacherId,
        title: title.trim(),
        content: content.trim(),
        icon: icon?.trim() || null,
        order: (lastSection?.order ?? -1) + 1,
      },
    });

    await logActivity(
      auth.user,
      "CREATE",
      "TeacherSection",
      `Menambah bagian profil: ${section.title}`
    );

    return NextResponse.json(section, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "[teacher-sections] POST error");
    return NextResponse.json(
      { error: "Gagal menambah bagian profil." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/me/teacher/sections
 * Update sections (bulk update for reordering and visibility)
 */
export async function PUT(req: NextRequest) {
  try {
    const csrfError = await requireCsrf(req);
    if (csrfError) return csrfError;

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Find teacher linked to this user
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { teacherId: true },
    });

    if (!user?.teacherId) {
      return NextResponse.json(
        { error: "Akun Anda belum tertaut ke data guru." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { sections } = body;

    if (!Array.isArray(sections)) {
      return NextResponse.json(
        { error: "Data sections tidak valid." },
        { status: 400 }
      );
    }

    // Update each section
    for (const section of sections) {
      if (!section.id) continue;

      await db.teacherSection.update({
        where: {
          id: section.id,
          teacherId: user.teacherId, // Ensure ownership
        },
        data: {
          title: section.title?.trim(),
          content: section.content?.trim(),
          icon: section.icon?.trim() || null,
          order: section.order,
          isVisible: section.isVisible,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "[teacher-sections] PUT error");
    return NextResponse.json(
      { error: "Gagal menyimpan bagian profil." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/me/teacher/sections
 * Delete a section
 */
export async function DELETE(req: NextRequest) {
  try {
    const csrfError = await requireCsrf(req);
    if (csrfError) return csrfError;

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Find teacher linked to this user
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { teacherId: true },
    });

    if (!user?.teacherId) {
      return NextResponse.json(
        { error: "Akun Anda belum tertaut ke data guru." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("id");

    if (!sectionId) {
      return NextResponse.json(
        { error: "Section ID wajib diisi." },
        { status: 400 }
      );
    }

    // Delete the section (ensure ownership)
    const deleted = await db.teacherSection.deleteMany({
      where: {
        id: sectionId,
        teacherId: user.teacherId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Bagian profil tidak ditemukan." },
        { status: 404 }
      );
    }

    await logActivity(
      auth.user,
      "DELETE",
      "TeacherSection",
      `Menghapus bagian profil: ${sectionId}`
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "[teacher-sections] DELETE error");
    return NextResponse.json(
      { error: "Gagal menghapus bagian profil." },
      { status: 500 }
    );
  }
}
