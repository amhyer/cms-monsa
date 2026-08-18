/**
 * Image type detection from file content (magic bytes) for the upload
 * endpoint. The server must NOT trust `file.type` from the client or the
 * file name extension — both are attacker-controlled. See SECURITY_AUDIT.md
 * finding C2 (stored XSS via spoofed MIME / .html uploads).
 *
 * Only the four types the CMS accepts are whitelisted:
 * JPEG, PNG, GIF, WebP.
 */

export type ImageType = "jpeg" | "png" | "gif" | "webp";

export const ALLOWED_IMAGE_TYPES: readonly ImageType[] = [
  "jpeg",
  "png",
  "gif",
  "webp",
];

/** Canonical MIME type per detected image type. */
export const IMAGE_TYPE_MIME: Record<ImageType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

/** Canonical (whitelisted) file extension per detected image type. */
export const IMAGE_TYPE_EXT: Record<ImageType, string> = {
  jpeg: "jpg",
  png: "png",
  gif: "gif",
  webp: "webp",
};

/**
 * Detect the image type from its magic bytes.
 * Returns the detected type, or `null` if the content is not a supported
 * image (including HTML/SVG/scripts disguised with an image extension).
 */
export function detectImageType(buffer: Buffer | Uint8Array): ImageType | null {
  const b = buffer;
  const len = b.length;

  // JPEG: FF D8 FF
  if (len >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    len >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "png";
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    len >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return "gif";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    len >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

/**
 * Detect a PDF from its magic bytes. PDF files carry the 5-byte header
 * "%PDF-" (0x25 0x50 0x44 0x46 0x2D). The header normally sits at offset 0,
 * but a handful of exporters prepend junk bytes, so scan the first 1024 bytes.
 * Used by the document upload endpoint — the server must never trust
 * `file.type` or the file name extension (both attacker-controlled).
 */
export function detectPdf(buffer: Buffer | Uint8Array): boolean {
  const max = Math.min(buffer.length, 1024);
  for (let i = 0; i <= max - 5; i++) {
    if (
      buffer[i] === 0x25 &&
      buffer[i + 1] === 0x50 &&
      buffer[i + 2] === 0x44 &&
      buffer[i + 3] === 0x46 &&
      buffer[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}
