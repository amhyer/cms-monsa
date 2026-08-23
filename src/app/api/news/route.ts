import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { rateLimitPublicGet } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log";
import { slugify } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import { withCache } from "@/lib/cache";
import { createNewsSchema, validateBody } from "@/lib/validations";

export async function GET(req: NextRequest) {
  // Rate limit public scope: max 60 requests per minute per IP
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "public";
  if (scope === "public") {
    const rateLimited = await rateLimitPublicGet(req, 60, 60000);
    if (rateLimited) return rateLimited;
  }
  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(24, Math.max(1, Number(searchParams.get("limit") || "9")));
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

  return withCache(
    NextResponse.json({
      items: items.map((n) => ({ ...n, authorName: n.author?.name ?? "—" })),
      total, page, limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }),
    scope === "public" ? "public, s-maxage=120, stale-while-revalidate=300" : ""
  );
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const validation = validateBody(createNewsSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title, content, excerpt, coverImage, category, status } = validation.data;
  const sanitizedContent = sanitizeHtml(content);
  const trimmedExcerpt = (excerpt ?? "").slice(0, 500);

  let slug = slugify(title);
  const existing = await db.news.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const publishedAt = status === "PUBLISHED" ? new Date() : null;

  const news = await db.news.create({
    data: {
      title,
      slug,
      excerpt: trimmedExcerpt,
      content: sanitizedContent,
      coverImage: coverImage || null,
      category,
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
