import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { slugify } from "@/lib/format";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(24, Math.max(1, Number(searchParams.get("limit") || "9")));
  const scope = searchParams.get("scope") || "public"; // public | admin
  const status = searchParams.get("status") || "";

  const where: Record<string, unknown> = {};
  if (scope === "public") {
    where.status = "PUBLISHED";
  } else {
    // admin scope: require auth
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    if (status) where.status = status;
  }
  if (category && category !== "all") where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { excerpt: { contains: search } },
    ];
  }

  const [total, items] = await Promise.all([
    db.news.count({ where }),
    db.news.findMany({
      where,
      include: { author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    items: items.map((n) => ({
      ...n,
      authorName: n.author?.name ?? "—",
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Judul wajib diisi." }, { status: 400 });
  }

  let slug = slugify(title);
  const existing = await db.news.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const status = body.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const publishedAt = status === "PUBLISHED" ? new Date() : null;

  const news = await db.news.create({
    data: {
      title,
      slug,
      excerpt: String(body.excerpt ?? ""),
      content: String(body.content ?? ""),
      coverImage: body.coverImage || null,
      category: String(body.category || "Kegiatan"),
      status,
      authorId: auth.user.id,
      publishedAt,
    },
    include: { author: { select: { name: true } } },
  });

  await logActivity(
    auth.user,
    "CREATE",
    "News",
    `Membuat berita: ${title}`,
    news.id
  );

  return NextResponse.json({ ...news, authorName: news.author?.name });
}
