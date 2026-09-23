import NextImage, { type ImageProps } from "next/image";

/**
 * Pembungkus next/image untuk src yang nilainya bisa diisi admin bebas
 * (kolom "Gunakan URL" di image-upload.tsx, coverImage berita, foto
 * guru/sekolah, dll).
 *
 * next/image MENOLAK host yang tidak ada di images.remotePatterns
 * (error runtime + gambar pecah). Untuk host di luar daftar, optimizer
 * dimatikan per-gambar (prop `unoptimized`) sehingga browser memuat URL
 * mentah — persis perilaku <img> sebelum migrasi next/image, sehingga
 * tidak ada konten lama admin yang tiba-tiba rusak.
 *
 * OPTIMIZED_REMOTE_HOSTS wajib sinkron dengan remotePatterns di
 * next.config.ts — dijaga oleh tes regresi di __tests__/smart-image.test.ts.
 */
export const OPTIMIZED_REMOTE_HOSTS = [
  "picsum.photos",
  "i.pravatar.cc",
  "avatars.githubusercontent.com",
];

/** Murni & tanpa DOM — mudah diuji. */
export function resolveImageSrc(src: string): {
  src: string;
  unoptimized: boolean;
} {
  const s = src.trim();
  // Protocol-relative "//host/..." = host EKSTERNAL — jangan tertipu cek "/"
  // di bawah; browser me-resolve-nya ke https host lain.
  if (s.startsWith("//")) return { src: s, unoptimized: true };
  // Same-origin: /uploads/..., /demo/..., /api/..., /logo.svg — selalu aman
  // di-optimasi (optimizer tidak mem-fetch keluar).
  if (s.startsWith("/")) return { src: s, unoptimized: false };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    // Nilai aneh/relatif-ke-hash — biarkan browser yang memutuskan.
    return { src: s, unoptimized: true };
  }
  if (u.protocol === "https:" && OPTIMIZED_REMOTE_HOSTS.includes(u.hostname)) {
    return { src: s, unoptimized: false };
  }
  // https host tak terdaftar, http (terblokir CSP img-src juga), data:, dll.
  return { src: s, unoptimized: true };
}

/** Drop-in pengganti `import Image from "next/image"`. */
export function Image({ src, ...props }: ImageProps) {
  if (typeof src !== "string") {
    // StaticImport (import gambar build-time) — selalu same-origin.
    return <NextImage src={src} {...props} />;
  }
  const resolved = resolveImageSrc(src);
  return (
    <NextImage
      {...props}
      src={resolved.src}
      unoptimized={resolved.unoptimized ? true : undefined}
    />
  );
}
