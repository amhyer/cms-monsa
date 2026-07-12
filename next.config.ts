import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Allow framing from the preview panel + same-origin.
  // (The preview panel embeds the app in an iframe; "DENY" blocks it.)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
  // 'unsafe-eval' needed for Next.js dev mode (HMR).
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
      // Connect: same-origin API + dev websocket for HMR.
      "connect-src 'self' ws: wss:",
      // No plugins.
      "object-src 'none'",
      "base-uri 'self'",
      // Allow the preview panel to embed this app in an iframe.
      // 'self' = same-origin; space-z.ai = the preview panel host.
      "frame-ancestors 'self' https://*.space-z.ai https://space-z.ai",
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
