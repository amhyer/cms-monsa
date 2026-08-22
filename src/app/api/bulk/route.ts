import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const { entity, ids } = body;

  if (!entity || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "Entity dan IDs wajib diisi." },
      { status: 400 }
    );
  }

  if (ids.length > 100) {
    return NextResponse.json(
      { error: "Maksimal 100 item per batch." },
      { status: 400 }
    );
  }

  // Map entity to model and required role
  type DeleteModel = {
    deleteMany(args: {
      where: { id: { in: string[] } };
    }): Promise<{ count: number }>;
  };
  const entityConfig: Record<
    string,
    { model: DeleteModel; requiredRole: string; nameLabel: string }
  > = {
    news: { model: db.news, requiredRole: "OPERATOR", nameLabel: "title" },
    announcements: { model: db.announcement, requiredRole: "OPERATOR", nameLabel: "title" },
    gallery: { model: db.galleryItem, requiredRole: "OPERATOR", nameLabel: "title" },
    teachers: { model: db.teacher, requiredRole: "OPERATOR", nameLabel: "name" },
    achievements: { model: db.achievement, requiredRole: "OPERATOR", nameLabel: "title" },
    students: { model: db.student, requiredRole: "SUPER_ADMIN", nameLabel: "name" },
    documents: { model: db.document, requiredRole: "OPERATOR", nameLabel: "title" },
    enrollments: { model: db.enrollment, requiredRole: "SUPER_ADMIN", nameLabel: "fullName" },
  };

  const config = entityConfig[entity];
  if (!config) {
    return NextResponse.json({ error: "Entity tidak valid." }, { status: 400 });
  }

  // Check role requirement
  if (config.requiredRole === "SUPER_ADMIN" && auth.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  try {
    // Delete items
    const result = await config.model.deleteMany({
      where: { id: { in: ids } },
    });

    await logActivity(
      auth.user,
      "DELETE",
      entity,
      `Bulk delete ${result.count} ${entity}`,
      ids.join(",")
    );

    return NextResponse.json({
      ok: true,
      deleted: result.count,
      entity,
    });
  } catch (e) {
    logger.error({ err: e }, "[bulk-delete] error");
    return NextResponse.json({ error: "Gagal menghapus item." }, { status: 500 });
  }
}
