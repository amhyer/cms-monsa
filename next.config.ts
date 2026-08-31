import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";
// Vercel menandai env VERCEL=1. Di Vercel output "standalone" tidak perlu
// (Vercel memakai build system sendiri) dan malah menambah ukuran artefak;
// standalone hanya dipakai untuk self-host (Docker / Node standalone).
const isVercel = process.env.VERCEL === "1";
// Production domain — frame-ancestors only allows embedding from the school site itself.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sdn-mongisidi1.sch.id";

const securityHeaders = [
  // Prevent MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // NOTE: X-Frame-Options is intentionally omitted. It is deprecated in favor
  // of CSP frame-ancestors, and having both causes the browser to apply the
  // stricter one — which blocks the preview panel (cross-origin iframe).
  // CSP frame-ancestors below handles clickjacking protection instead.
  // Only send origin to same-origin or on downgrade; trim to origin otherwise.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Force HTTPS for 2 years, include subdomains, preload-ready.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Content Security Policy — restrict what can load/execute.
  // 'unsafe-inline' needed for style because Next/shadcn inject inline styles.
  // 'unsafe-eval' is needed ONLY for Next.js dev mode (HMR) and is removed in
  // production. frame-ancestors in production is restricted to the school
  // domain only (z.ai / space-z.ai preview panels are dev-only).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // Images: allow self + external (picsum, pravatar, uploads) + data URIs.
      "img-src 'self' data: https:",
      // Media (gallery videos).
      "media-src 'self' https:",
      // Frames: allow youtube embeds for gallery videos.
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      // Connect: same-origin API + dev websocket for HMR + Sentry error tracking.
      "connect-src 'self' ws: wss: https://*.sentry.io",
      // Manifest: allow self + Vercel SSO proxy for PWA manifest.
      "manifest-src 'self' https:",
      // No plugins.
      "object-src 'none'",
      "base-uri 'self'",
      // In production, only the school site itself may embed this app
      // (clickjacking protection). The z.ai/space-z.ai preview panels are
      // allowed in development only.
      isProd
        ? `frame-ancestors 'self' ${siteUrl}`
        : "frame-ancestors 'self' https://*.space-z.ai https://space-z.ai https://*.z.ai https://z.ai",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Standalone hanya untuk self-host; nonaktif saat di Vercel.
  output: isVercel ? undefined : "standalone",

  // Source maps di production untuk debugging (Lighthouse advisory).
  productionBrowserSourceMaps: true,

  // Prisma (native query engine) jangan di-bundle webpack/turbopack —
  // tanpa ini `next start` di CI sering 500 "Query engine library not found"
  // / "Can't reach database server" padahal `prisma db push` + seed lulus
  // (CLI memuat engine dari node_modules, Next yang mem-bundle tidak).
  serverExternalPackages: ["@prisma/client", "prisma"],

  // distDir dapat diganti lewat env (mis. preview paralel di port lain tanpa
  // bentrok dengan dev server utama yang memegang lock .next). Default .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Optimasi gambar lewat next/image (dipakai bertahap di komponen).
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Izinkan gambar dari domain publik yang dipakai di konten (picsum,
    // pravatar, uploads) + Google Fonts. Tambahkan domain lain bila perlu.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  experimental: {
    // Proxy (Next 16) meng-clone & mem-buffer request body; default 10MB
    // memotong FormData sebelum route handler menerimanya → upload besar gagal
    // 500 ("Failed to parse body as FormData") alih-alih pesan batas ukuran.
    // Batas bisnis upload PDF adalah 15MB (MAX_SIZE di
    // src/app/api/bos-documents/route.ts), jadi buffer proxy harus LEBIH besar
    // dari itu agar file >15MB tiba utuh dan route menolaknya dengan 400
    // "Ukuran file maksimal 15 MB." — bukan 500 karena body terpotong.
    proxyClientMaxBodySize: "25mb",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// next-intl: menghubungkan konfigurasi request (src/i18n/request.ts) ke next-intl.
const withNextIntl = createNextIntlPlugin();

export default withSentryConfig(
  withNextIntl(nextConfig),
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger source map for presale sources to increase the
    // accuracy of stack traces in error messages.
    widenClientFileUpload: true,

    // Transpile Sentry client-side config files to work with older browsers.
    transpileClientSDK: true,

    // Hides source maps from generated client bundles.
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size.
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    // See https://docs.sentry.io/platforms/javascript/guides/nextjs/crons/ for
    // further information.
    automaticVercelMonitors: true,
  },
);
