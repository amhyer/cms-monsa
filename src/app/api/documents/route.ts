import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "public";
  const category = searchParams.get("category");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));

  if (scope === "admin") {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const where: Record<string, unknown> = {};
    if (category && category !== "all") where.category = category;

    const [total, items] = await Promise.all([
      db.document.count({ where }),
      db.document.findMany({
        where,
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      items: items.map((d) => ({
        ...d,
        uploadedByName: d.uploadedBy?.name ?? "—",
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }

  // Public: only public documents
  const where = { isPublic: true, ...(category && category !== "all" ? { category } : {}) };
  const [total, items] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const fileUrl = String(body.fileUrl ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const fileSize = Number(body.fileSize ?? 0);
  const mimeType = String(body.mimeType ?? "application/octet-stream");

  if (!title || !fileUrl || !fileName) {
    return NextResponse.json(
      { error: "Judul, URL file, dan nama file wajib diisi." },
      { status: 400 }
    );
  }

  const item = await db.document.create({
    data: {
      title,
      description: body.description || null,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      category: String(body.category || "Umum"),
      uploadedById: auth.user.id,
      isPublic: body.isPublic !== false,
    },
  });

  await logActivity(auth.user, "CREATE", "Document", `Mengunggah dokumen: ${title}`, item.id);
  return NextResponse.json(item);
}
