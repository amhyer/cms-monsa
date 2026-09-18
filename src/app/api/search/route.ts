import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimitPublicGet } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Rate limit (temuan review M3): endpoint publik ini menjalankan EMPAT query
  // `contains` paralel. Di Postgres, `contains` = LIKE '%…%' yang tidak bisa
  // memakai index → sequential scan. Tanpa pembatas, satu loop curl cukup
  // untuk membebani database. Disamakan dengan endpoint publik lain (30/menit).
  const rateLimited = await rateLimitPublicGet(req, 30, 60000);
  if (rateLimited) return rateLimited;

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
    db.schoolAnnouncement.findMany({
      where: {
        isPublished: true,
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
      url: `/news/${n.slug}`,
      date: n.publishedAt,
    })),
    // Announcements are shown on the home page (RunningAnnouncements).
    ...announcements.map((a) => ({
      type: "announcement" as const,
      id: a.id,
      title: a.title,
      description: a.content.slice(0, 150),
      category: "Pengumuman",
      url: "/",
      date: a.createdAt,
    })),
    ...teachers.map((t) => ({
      type: "teacher" as const,
      id: t.id,
      title: t.name,
      description: t.subject || t.position,
      category: "Guru",
      url: "/academic",
      date: null,
    })),
    ...achievements.map((a) => ({
      type: "achievement" as const,
      id: a.id,
      title: a.studentName ? `${a.title} - ${a.studentName}` : a.title,
      description: a.description,
      // Achievements are highlighted on the home page.
      category: `${a.level} - ${a.category}`,
      url: "/",
      date: a.date,
    })),
  ].sort((a, b) => {
    if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  // `total` sebelumnya melaporkan items.length SEBELUM dipotong, sehingga bisa
  // lebih besar dari jumlah item yang benar-benar dikembalikan (temuan L3/M3).
  // Endpoint ini tidak dipaginasi, jadi total = jumlah hasil yang dikirim.
  const limited = items.slice(0, limit);

  return NextResponse.json({
    items: limited,
    total: limited.length,
    query: search,
  });
}
