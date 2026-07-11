import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { slugify } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  // Allow fetch by id or slug
  const news = await db.news.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { author: { select: { name: true } } },
  });
  if (!news) {
    return NextResponse.json({ error: "Berita tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ...news, authorName: news.author?.name });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const existing = await db.news.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Berita tidak ditemukan." }, { status: 404 });
  }

  const body = await req.json();
  const title = String(body.title ?? existing.title).trim();

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
      excerpt: String(body.excerpt ?? existing.excerpt),
      content: String(body.content ?? existing.content),
      coverImage: body.coverImage ?? existing.coverImage,
      category: String(body.category ?? existing.category),
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

export async function DELETE(_req: NextRequest, { params }: Ctx) {
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
