import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole, getSession } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { slugify } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";

const NEWS_CATEGORIES = ["Akademik", "Kegiatan", "Prestasi"] as const;
const MAX_CONTENT_LENGTH = 50000;
const MAX_TITLE_LENGTH = 200;
const MAX_EXCERPT_LENGTH = 500;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  // Allow fetch by id or slug.
  const news = await db.news.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { author: { select: { name: true } } },
  });
  if (!news) {
    return NextResponse.json({ error: "Berita tidak ditemukan." }, { status: 404 });
  }
  // Public visitors may only read PUBLISHED articles. Authenticated staff
  // (operator/admin) may read DRAFTs too (for editing/preview).
  if (news.status !== "PUBLISHED") {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Berita tidak ditemukan." }, { status: 404 });
    }
  }
  return NextResponse.json({ ...news, authorName: news.author?.name });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const existing = await db.news.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Berita tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json();
  const title = String(body.title ?? existing.title).trim();
  if (!title) {
    return NextResponse.json({ error: "Judul wajib diisi." }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json(
      { error: `Judul maksimal ${MAX_TITLE_LENGTH} karakter.` },
      { status: 400 }
    );
  }

  // Validate category against whitelist (Bug #4).
  const rawCategory = String(body.category ?? existing.category);
  const category = (NEWS_CATEGORIES as readonly string[]).includes(rawCategory)
    ? rawCategory
    : "Kegiatan";

  // Validate & sanitize content (Bug #1 XSS, Bug #4 length).
  const rawContent = String(body.content ?? existing.content);
  if (rawContent.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Konten terlalu panjang (maksimal ${MAX_CONTENT_LENGTH} karakter).` },
      { status: 400 }
    );
  }
  const content = sanitizeHtml(rawContent);

  const excerpt = String(body.excerpt ?? existing.excerpt).slice(0, MAX_EXCERPT_LENGTH);

  let slug = existing.slug;
  if (title && title !== existing.title) {
    slug = slugify(title);
    const dup = await db.news.findFirst({ where: { slug, NOT: { id } } });
    if (dup) slug = `${slug}-${Date.now().toString(36)}`;
  }

  const prevStatus = existing.status;
  const status = body.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const publishedAt =
    status === "PUBLISHED" && !existing.publishedAt
      ? new Date()
      : existing.publishedAt;

  const updated = await db.news.update({
    where: { id },
    data: {
      title,
      slug,
      excerpt,
      content,
      coverImage: body.coverImage ?? existing.coverImage,
      category,
      status,
      publishedAt,
    },
    include: { author: { select: { name: true } } },
  });

  await logActivity(
    auth.user,
    "UPDATE",
    "News",
    `Memperbarui berita: ${title}`,
    id
  );
  if (prevStatus !== status) {
    await logActivity(
      auth.user,
      "UPDATE",
      "News",
      `Mengubah status berita "${title}" menjadi ${status}`,
      id
    );
  }

  return NextResponse.json({ ...updated, authorName: updated.author?.name });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const existing = await db.news.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Berita tidak ditemukan." }, { status: 404 });
  }

  await db.news.delete({ where: { id } });
  await logActivity(
    auth.user,
    "DELETE",
    "News",
    `Menghapus berita: ${existing.title}`,
    id
  );

  return NextResponse.json({ ok: true });
}
