import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { rateLimitPublicGet } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log";
import { createGallerySchema, validateBody } from "@/lib/validations";

export async function GET(req: NextRequest) {
  // Rate limit: max 60 requests per minute per IP (public gallery)
  const rateLimited = await rateLimitPublicGet(req, 60, 60000);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(48, Math.max(1, Number(searchParams.get("limit") || "24")));
  const where: Record<string, unknown> = {};
  if (category && category !== "all") where.category = category;
  if (type && type !== "all") where.type = type;
  const [total, items] = await Promise.all([
    db.galleryItem.count({ where }),
    db.galleryItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const res = NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
  res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res;
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createGallerySchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title, description, imageUrl, url, category } = validation.data;
  const item = await db.galleryItem.create({
    data: {
      title,
      description: description || null,
      type: body.type === "VIDEO" ? "VIDEO" : "PHOTO",
      url: url || imageUrl || "",
      thumbnail: body.thumbnail || null,
      category: category || "Kegiatan",
    },
  });
  await logActivity(auth.user, "CREATE", "Gallery", `Menambah media galeri: ${title}`, item.id);
  return NextResponse.json(item);
}
