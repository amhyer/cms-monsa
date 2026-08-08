import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sdn-mongisidi1.sch.id";
    
    const news = await db.news.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    const announcements = await db.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        title: true,
        content: true,
        createdAt: true,
      },
    });

    const items = [
      ...news.map((n) => ({
        title: n.title,
        link: `${siteUrl}/news/${n.slug}`,
        description: n.excerpt || n.content.slice(0, 200),
        pubDate: (n.publishedAt || n.createdAt).toUTCString(),
        category: "Berita",
      })),
      ...announcements.map((a) => ({
        title: a.title,
        link: `${siteUrl}/`,
        description: a.content.slice(0, 200),
        pubDate: a.createdAt.toUTCString(),
        category: "Pengumuman",
      })),
    ].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>UPT SPF SD Negeri Unggulan Mongisidi 1</title>
    <link>${siteUrl}</link>
    <description>Berita dan pengumuman terbaru dari UPT SPF SD Negeri Unggulan Mongisidi 1</description>
    <language>id</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/api/rss" rel="self" type="application/rss+xml" />
    ${items
      .map(
        (item) => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <category>${item.category}</category>
    </item>`
      )
      .join("\n")}
  </channel>
</rss>`;

    return new NextResponse(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("[rss]", err);
    return NextResponse.json(
      { error: "Gagal memuat data RSS." },
      { status: 500 }
    );
  }
}
