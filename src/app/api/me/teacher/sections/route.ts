import { safeJson, withErrorHandling } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, hasRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

/**
 * GET /api/me/teacher/sections?teacherId=xxx
 * - GURU: get sections for their own profile (teacherId ignored)
 * - OPERATOR/SUPER_ADMIN: get sections for specified teacherId (or all teachers)
 */
async function GET_impl(req: NextRequest) {
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
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const GET = withErrorHandling(GET_impl, { errorMessage: "Gagal memuat bagian profil." });

/**
 * POST /api/me/teacher/sections
 * Create a new section for a teacher
 * - GURU: creates for their own profile
 * - OPERATOR/SUPER_ADMIN: can specify teacherId in body
 */
async function POST_impl(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = await safeJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
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
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const POST = withErrorHandling(POST_impl, { errorMessage: "Gagal menambah bagian profil." });

/**
 * PUT /api/me/teacher/sections
 * Update sections (bulk update for reordering and visibility)
 * - GURU: can only update their own sections
 * - OPERATOR/SUPER_ADMIN: can update any teacher's sections
 */
async function PUT_impl(req: NextRequest) {
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

  const parsed = await safeJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
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
    const where = ownedTeacherId
      ? { id: section.id, teacherId: ownedTeacherId }
      : { id: section.id };

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
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const PUT = withErrorHandling(PUT_impl, { errorMessage: "Gagal menyimpan bagian profil." });

/**
 * DELETE /api/me/teacher/sections?id=xxx
 * Delete a section
 * - GURU: can only delete their own sections
 * - OPERATOR/SUPER_ADMIN: can delete any teacher's sections
 */
async function DELETE_impl(req: NextRequest) {
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
  const where = ownedTeacherId
    ? { id: sectionId, teacherId: ownedTeacherId }
    : { id: sectionId };

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
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const DELETE = withErrorHandling(DELETE_impl, { errorMessage: "Gagal menghapus bagian profil." });
