import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolveImageSrc, OPTIMIZED_REMOTE_HOSTS } from "../smart-image";

/**
 * Kontrak pemilih-mode next/image: src yang bisa diisi admin bebas harus
 * tetap tampil. Host di luar images.remotePatterns next.config WAJIB jatuh
 * ke unoptimized (browser memuat URL mentah) — kalau tidak, next/image
 * melempar error runtime dan gambar pecah.
 */
describe("resolveImageSrc", () => {
  it("path relatif same-origin → tetap di-optimasi", () => {
    for (const src of ["/uploads/a.jpg", "/demo/x.jpg", "/api/favicon", "/logo.png"]) {
      expect(resolveImageSrc(src)).toEqual({ src, unoptimized: false });
    }
  });

  it("https host terdaftar di remotePatterns → di-optimasi", () => {
    for (const host of OPTIMIZED_REMOTE_HOSTS) {
      const src = `https://${host}/img.jpg`;
      expect(resolveImageSrc(src)).toEqual({ src, unoptimized: false });
    }
  });

  it("https host asing (sumber isian 'Gunakan URL' admin) → unoptimized", () => {
    const src = "https://cdn.facebook.com/u/foto.jpg";
    expect(resolveImageSrc(src)).toEqual({ src, unoptimized: true });
  });

  it("subdomain host terdaftar TIDAK ikut lolos (remotePatterns exact-host) → unoptimized", () => {
    const src = "https://picsum.photos.example.org/a.jpg";
    expect(resolveImageSrc(src)).toEqual({ src, unoptimized: true });
  });

  it("http, data URI, dan nilai tak-terurai → unoptimized, src utuh", () => {
    for (const src of [
      "http://picsum.photos/a.jpg",
      "data:image/svg+xml;base64,AAAA",
      "//cdn.example.org/a.jpg",
      "bukan-url sama sekali",
    ]) {
      const r = resolveImageSrc(src);
      expect(r.unoptimized).toBe(true);
      expect(r.src).toBe(src.trim());
    }
  });

  it("whitespace di ujung di-trim sebelum diputuskan", () => {
    expect(resolveImageSrc("  /uploads/a.jpg  ")).toEqual({
      src: "/uploads/a.jpg",
      unoptimized: false,
    });
  });
});

describe("OPTIMIZED_REMOTE_HOSTS ↔ next.config.ts remotePatterns", () => {
  const configSrc = readFileSync("next.config.ts", "utf8");
  const configHosts = [
    ...configSrc.matchAll(/hostname:\s*"([^"]+)"/g),
  ].map((m) => m[1]);

  it("set host wrapper identik dengan remotePatterns config", () => {
    expect([...OPTIMIZED_REMOTE_HOSTS].sort()).toEqual([...configHosts].sort());
  });
});
