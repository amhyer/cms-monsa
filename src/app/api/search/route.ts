import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "10")));

  if (!query || query.length < 2) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const search = query.trim();

  // Search across multiple entities in parallel
  const [news, announcements, teachers, achievements] = await Promise.all([
    db.news.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { title: { contains: search } },
          { excerpt: { contains: search } },
          { content: { contains: search } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        category: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: Math.ceil(limit / 4),
    }),
    db.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: Math.ceil(limit / 4),
    }),
    db.teacher.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: search } },
          { subject: { contains: search } },
        ],
      },
      select: {
        id: true,
        name: true,
        subject: true,
        position: true,
      },
      orderBy: { name: "asc" },
      take: Math.ceil(limit / 4),
    }),
    db.achievement.findMany({
      where: {
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { studentName: { contains: search } },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        studentName: true,
        level: true,
        category: true,
        date: true,
      },
      orderBy: { date: "desc" },
      take: Math.ceil(limit / 4),
    }),
  ]);

  // Transform results into a unified format
  const items = [
    ...news.map((n) => ({
      type: "news" as const,
      id: n.id,
      title: n.title,
      description: n.excerpt,
      category: n.category,
      url: `/#/news/${n.slug}`,
      date: n.publishedAt,
    })),
    ...announcements.map((a) => ({
      type: "announcement" as const,
      id: a.id,
      title: a.title,
      description: a.content.slice(0, 150),
      category: "Pengumuman",
      url: "/#/announcements",
      date: a.createdAt,
    })),
    ...teachers.map((t) => ({
      type: "teacher" as const,
      id: t.id,
      title: t.name,
      description: t.subject || t.position,
      category: "Guru",
      url: "/#/academic",
      date: null,
    })),
    ...achievements.map((a) => ({
      type: "achievement" as const,
      id: a.id,
      title: a.studentName ? `${a.title} - ${a.studentName}` : a.title,
      description: a.description,
      category: `${a.level} - ${a.category}`,
      url: "/#/achievements",
      date: a.date,
    })),
  ].sort((a, b) => {
    if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  return NextResponse.json({
    items: items.slice(0, limit),
    total: items.length,
    query: search,
  });
}
