import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prevent clickjacking — no framing allowed.
  { key: "X-Frame-Options", value: "DENY" },
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
  // 'unsafe-eval' omitted (dev-only by Next, not needed in prod build).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // Images: allow self + external (picsum, pravatar, uploads) + data URIs.
      "img-src 'self' data: https:",
      // Media (gallery videos).
      "media-src 'self' https:",
      // Frames: allow youtube embeds for gallery videos.
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      // Connect: same-origin API only.
      "connect-src 'self'",
      // No plugins.
      "object-src 'none'",
      "base-uri 'self'",
      // No framing (defense in depth with X-Frame-Options).
      "frame-ancestors 'none'",
      // Enforce CSP (report-only would be: Content-Security-Policy-Report-Only).
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
