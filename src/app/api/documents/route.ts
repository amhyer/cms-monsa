import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCsrf } from "@/lib/csrf";
import { requireRole } from "@/lib/auth";
import { createSchoolDocumentSchema, validateBody } from "@/lib/validations";
import { logger } from "@/lib/logger";

/**
 * GET /api/documents
 * Public: get school documents
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const category = searchParams.get("category");
    const search = searchParams.get("q");

    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const documents = await db.schoolDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        fileName: true,
        fileSize: true,
        fileType: true,
        version: true,
        accessLevel: true,
        downloadCount: true,
        createdAt: true,
      },
    });

    // Get categories with counts
    const categories = await db.schoolDocument.groupBy({
      by: ["category"],
      where: { isPublished: true },
      _count: { id: true },
    });

    return NextResponse.json({
      documents,
      categories: categories.map((c) => ({
        name: c.category,
        count: c._count.id,
      })),
    });
  } catch (e) {
    logger.error({ err: e }, "[documents] GET error");
    return NextResponse.json(
      { error: "Gagal memuat dokumen." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 * Admin: upload document
 */
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const validation = validateBody(createSchoolDocumentSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const {
      title,
      description,
      category,
      fileUrl,
      fileName,
      fileSize,
      fileType,
      version,
      accessLevel,
    } = validation.data;

    // Create document
    const document = await db.schoolDocument.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category: category || "Administrasi",
        fileUrl: fileUrl.trim(),
        fileName: fileName?.trim() || title.trim(),
        fileSize: fileSize || 0,
        fileType: fileType || "pdf",
        version: version?.trim() || null,
        accessLevel: accessLevel || "PUBLIC",
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "[documents] POST error");
    return NextResponse.json(
      { error: "Gagal mengunggah dokumen." },
      { status: 500 }
    );
  }
}
