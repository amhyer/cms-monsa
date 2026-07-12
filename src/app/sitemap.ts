import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

/**
 * Dynamic sitemap generated from database content.
 *
 * NOTE: This app currently uses hash-based routing (/#/news/slug) due to the
 * single-route sandbox constraint. Hash fragments are not sent to the server,
 * so Google may not fully index them. When migrating to real Next.js App
 * Router routes (/news/[slug]), update the URL builder below — the data
 * fetching logic stays the same.
 *
 * The base URL should match your production domain. Set NEXT_PUBLIC_SITE_URL
 * in your environment, or update the fallback below.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sdn-mongisidi1.sch.id";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static pages — always present.
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/#/profile`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/#/academic`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/#/news`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/#/gallery`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/#/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  // Dynamic news articles.
  let newsPages: MetadataRoute.Sitemap = [];
  try {
    const news = await db.news.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, publishedAt: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    });
    newsPages = news.map((n) => ({
      url: `${SITE_URL}/#/news/${n.slug}`,
      lastModified: n.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB not ready — skip dynamic entries.
  }

  return [...staticPages, ...newsPages];
}
