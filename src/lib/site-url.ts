/**
 * Base URL publik untuk tautan di email/notifikasi (mis. panduan membalas
 * pengaduan di dashboard). Mengikuti pola yang sama dengan sitemap.ts,
 * robots.ts, dan rss/route.ts: NEXT_PUBLIC_SITE_URL dengan fallback domain
 * produksi. Trailing slash dibuang agar hasil gabungan path bersih.
 */
export function getSiteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://sdn-mongisidi1.sch.id").replace(/\/+$/, "");
}