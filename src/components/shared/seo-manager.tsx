"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app";
import type { SiteSettingItem } from "@/lib/types";

/**
 * Dynamic SEO metadata manager for the App Router site.
 *
 * Watches pathname changes and updates:
 * - document.title
 * - meta description
 * - canonical link
 * - Open Graph tags (og:title, og:description, og:url, og:type)
 * - Twitter card tags
 * - JSON-LD structured data (EducationalOrganization, NewsArticle, BreadcrumbList)
 *
 * This is essential because most content metadata (titles, OG tags) is only
 * known client-side after fetching data — without this, every "page" would
 * share the same static title/description from layout.tsx.
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sdn-mongisidi1.sch.id";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.setAttribute("type", "application/ld+json");
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

/** Page-specific SEO config. */
type SeoConfig = {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: string;
  ogImage?: string;
  jsonLd?: { id: string; data: object }[];
};

function getPageSeo(pathname: string, settings: SiteSettingItem | null): SeoConfig {
  const schoolName = settings?.schoolName ?? "SD Negeri Unggulan Mongisidi 1";
  const schoolDesc =
    settings?.principalWelcome?.slice(0, 160) ??
    "Website resmi SD Negeri Unggulan Mongisidi 1 Makassar. Berita, profil, galeri, direktori guru, dan informasi SPMB.";

  // Home
  if (pathname === "/" || pathname === "") {
    return {
      title: `${schoolName} — Website Resmi Sekolah`,
      description: schoolDesc,
      canonicalPath: "/",
      ogType: "website",
      ogImage: settings?.logo ?? undefined,
      jsonLd: [
        {
          id: "ld-org",
          data: {
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            name: schoolName,
            url: SITE_URL,
            logo: settings?.logo ?? undefined,
            address: {
              "@type": "PostalAddress",
              streetAddress: settings?.address ?? "",
              addressLocality: "Makassar",
              addressRegion: "Sulawesi Selatan",
              addressCountry: "ID",
            },
            telephone: settings?.phone ?? undefined,
            email: settings?.email ?? undefined,
            identifier: settings?.npsn
              ? { "@type": "PropertyValue", name: "NPSN", value: settings.npsn }
              : undefined,
            sameAs: [settings?.facebook, settings?.instagram, settings?.youtube].filter(
              Boolean
            ),
          },
        },
        {
          id: "ld-website",
          data: {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: schoolName,
            url: SITE_URL,
            potentialAction: {
              "@type": "SearchAction",
              target: `${SITE_URL}/news?search={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
        },
      ],
    };
  }

  // News list
  if (pathname === "/news") {
    return {
      title: `Berita & Pengumuman — ${schoolName}`,
      description: `Berita terbaru, kegiatan, prestasi, dan pengumuman resmi dari ${schoolName}.`,
      canonicalPath: "/news",
      ogType: "website",
      jsonLd: [
        {
          id: "ld-breadcrumb",
          data: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Berita", item: `${SITE_URL}/news` },
            ],
          },
        },
      ],
    };
  }

  // News detail
  if (pathname.startsWith("/news/")) {
    return {
      title: `Berita — ${schoolName}`,
      description: "Berita dan kegiatan terbaru dari " + schoolName,
      canonicalPath: pathname,
      ogType: "article",
      jsonLd: [], // NewsArticle JSON-LD is injected by NewsDetailView after fetch
    };
  }

  // Profile
  if (pathname === "/profile") {
    return {
      title: `Profil Sekolah — ${schoolName}`,
      description: `Sejarah, visi-misi, struktur organisasi, dan fasilitas ${schoolName}.`,
      canonicalPath: "/profile",
      ogType: "website",
      jsonLd: [
        {
          id: "ld-breadcrumb",
          data: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Profil", item: `${SITE_URL}/profile` },
            ],
          },
        },
      ],
    };
  }

  // Academic
  if (pathname === "/academic") {
    return {
      title: `Akademik & Direktori — ${schoolName}`,
      description: `Direktori guru & staf, kalender akademik, dan ekstrakurikuler ${schoolName}.`,
      canonicalPath: "/academic",
      ogType: "website",
      jsonLd: [
        {
          id: "ld-breadcrumb",
          data: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Akademik", item: `${SITE_URL}/academic` },
            ],
          },
        },
      ],
    };
  }

  // Gallery
  if (pathname === "/gallery") {
    return {
      title: `Galeri Kegiatan — ${schoolName}`,
      description: `Dokumentasi foto dan video kegiatan, prestasi, serta fasilitas ${schoolName}.`,
      canonicalPath: "/gallery",
      ogType: "website",
      jsonLd: [
        {
          id: "ld-breadcrumb",
          data: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Galeri", item: `${SITE_URL}/gallery` },
            ],
          },
        },
      ],
    };
  }

  // Struktur Organisasi
  if (pathname === "/struktur-organisasi") {
    return {
      title: `Struktur Organisasi — ${schoolName}`,
      description: `Susunan organisasi ${schoolName} dalam menjalankan layanan pendidikan.`,
      canonicalPath: "/struktur-organisasi",
      ogType: "website",
      jsonLd: [
        {
          id: "ld-breadcrumb",
          data: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Struktur Organisasi", item: `${SITE_URL}/struktur-organisasi` },
            ],
          },
        },
      ],
    };
  }

  // Contact
  if (pathname === "/contact") {
    return {
      title: `Hubungi Kami & SPMB — ${schoolName}`,
      description: `Hubungi ${schoolName} atau daftar SPMB online. Alamat, telepon, email, dan lokasi sekolah.`,
      canonicalPath: "/contact",
      ogType: "website",
      jsonLd: [
        {
          id: "ld-breadcrumb",
          data: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Kontak", item: `${SITE_URL}/contact` },
            ],
          },
        },
      ],
    };
  }

  // Login / admin (noindex implied, minimal SEO)
  if (
    pathname === "/login" ||
    pathname === "/admin-login" ||
    pathname.startsWith("/dashboard")
  ) {
    return {
      title: pathname.includes("admin")
        ? `Portal Admin — ${schoolName}`
        : pathname.startsWith("/dashboard")
        ? `Dashboard — ${schoolName}`
        : `Login — ${schoolName}`,
      description: "Portal manajemen konten sekolah.",
      canonicalPath: "/login",
      ogType: "website",
    };
  }

  // Default fallback
  return {
    title: `${schoolName} — Website Resmi Sekolah`,
    description: schoolDesc,
    canonicalPath: "/",
    ogType: "website",
  };
}

/** Inject NewsArticle JSON-LD for a specific news item. */
export function injectNewsArticleJsonLd(news: {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  authorName?: string;
  publishedAt: string | null;
}) {
  upsertJsonLd("ld-newsarticle", {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: news.title,
    description: news.excerpt,
    image: news.coverImage ?? undefined,
    datePublished: news.publishedAt,
    dateModified: news.publishedAt,
    author: {
      "@type": "Person",
      name: news.authorName ?? "Redaksi Sekolah",
    },
    publisher: {
      "@type": "Organization",
      name: "SD Negeri Unggulan Mongisidi 1",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/news/${news.slug}`,
    },
  });
}

export function SeoManager() {
  const pathname = usePathname();
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    const seo = getPageSeo(pathname, settings);
    const fullUrl = `${SITE_URL}${seo.canonicalPath}`;

    // Title
    document.title = seo.title;

    // Meta description
    upsertMeta("name", "description", seo.description);

    // Canonical
    upsertCanonical(fullUrl);

    // Open Graph
    upsertMeta("property", "og:title", seo.title);
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("property", "og:url", fullUrl);
    upsertMeta("property", "og:type", seo.ogType ?? "website");
    upsertMeta("property", "og:site_name", "SD Negeri Unggulan Mongisidi 1");
    if (seo.ogImage) {
      upsertMeta("property", "og:image", seo.ogImage);
    }

    // Twitter Card
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seo.title);
    upsertMeta("name", "twitter:description", seo.description);
    if (seo.ogImage) {
      upsertMeta("name", "twitter:image", seo.ogImage);
    }

    // JSON-LD structured data
    // Clean up stale NewsArticle when not on a news detail page.
    if (!pathname.startsWith("/news/")) {
      removeJsonLd("ld-newsarticle");
    }
    // Inject page-specific JSON-LD.
    seo.jsonLd?.forEach(({ id, data }) => upsertJsonLd(id, data));
  }, [pathname, settings]);

  return null; // This component only manages head, renders nothing.
}
