import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, hasRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { logger } from "@/lib/logger";

/**
 * GET /api/me/teacher/sections?teacherId=xxx
 * - GURU: get sections for their own profile (teacherId ignored)
 * - OPERATOR/SUPER_ADMIN: get sections for specified teacherId (or all teachers)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const requestedTeacherId = searchParams.get("teacherId");

    // Determine which teacher's sections to fetch
    let teacherId: string;

    if (hasRole(auth.user, "OPERATOR")) {
      // OPERATOR/SUPER_ADMIN: can view any teacher's sections
      if (requestedTeacherId) {
        teacherId = requestedTeacherId;
      } else {
        // No teacherId specified - return empty (must specify)
        return NextResponse.json([]);
      }
    } else {
      // GURU: can only view their own sections
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
      teacherId = user.teacherId;
    }

    const sections = await db.teacherSection.findMany({
      where: { teacherId },
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
 * Create a new section for a teacher
 * - GURU: creates for their own profile
 * - OPERATOR/SUPER_ADMIN: can specify teacherId in body
 */
export async function POST(req: NextRequest) {
  try {
    const csrfError = await requireCsrf(req);
    if (csrfError) return csrfError;

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { title, content, icon, teacherId: bodyTeacherId } = body;

    // Determine which teacher to add section for
    let teacherId: string;

    if (hasRole(auth.user, "OPERATOR")) {
      // OPERATOR/SUPER_ADMIN: can add to any teacher
      if (!bodyTeacherId) {
        return NextResponse.json(
          { error: "teacherId wajib diisi untuk operator." },
          { status: 400 }
        );
      }
      teacherId = bodyTeacherId;
    } else {
      // GURU: can only add to their own profile
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
      teacherId = user.teacherId;
    }

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
      where: { teacherId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const section = await db.teacherSection.create({
      data: {
        teacherId,
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
 * - GURU: can only update their own sections
 * - OPERATOR/SUPER_ADMIN: can update any teacher's sections
 */
export async function PUT(req: NextRequest) {
  try {
    const csrfError = await requireCsrf(req);
    if (csrfError) return csrfError;

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Determine teacherId for ownership check
    let ownedTeacherId: string | null = null;
    if (!hasRole(auth.user, "OPERATOR")) {
      // GURU: get their teacherId for ownership check
      const user = await db.user.findUnique({
        where: { id: auth.user.id },
        select: { teacherId: true },
      });
      ownedTeacherId = user?.teacherId ?? null;

      if (!ownedTeacherId) {
        return NextResponse.json(
          { error: "Akun Anda belum tertaut ke data guru." },
          { status: 404 }
        );
      }
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

      // Build where clause with ownership check for GURU
      const where: Record<string, unknown> = { id: section.id };
      if (ownedTeacherId) {
        where.teacherId = ownedTeacherId; // GURU can only update own
      }

      await db.teacherSection.update({
        where,
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
 * DELETE /api/me/teacher/sections?id=xxx
 * Delete a section
 * - GURU: can only delete their own sections
 * - OPERATOR/SUPER_ADMIN: can delete any teacher's sections
 */
export async function DELETE(req: NextRequest) {
  try {
    const csrfError = await requireCsrf(req);
    if (csrfError) return csrfError;

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    // Determine teacherId for ownership check
    let ownedTeacherId: string | null = null;
    if (!hasRole(auth.user, "OPERATOR")) {
      // GURU: get their teacherId for ownership check
      const user = await db.user.findUnique({
        where: { id: auth.user.id },
        select: { teacherId: true },
      });
      ownedTeacherId = user?.teacherId ?? null;

      if (!ownedTeacherId) {
        return NextResponse.json(
          { error: "Akun Anda belum tertaut ke data guru." },
          { status: 404 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("id");

    if (!sectionId) {
      return NextResponse.json(
        { error: "Section ID wajib diisi." },
        { status: 400 }
      );
    }

    // Build where clause with ownership check for GURU
    const where: Record<string, unknown> = { id: sectionId };
    if (ownedTeacherId) {
      where.teacherId = ownedTeacherId; // GURU can only delete own
    }

    // Delete the section
    const deleted = await db.teacherSection.deleteMany({ where });

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
