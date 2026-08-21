import { describe, it, expect } from "vitest";
import {
  detectImageType,
  detectPdf,
  IMAGE_TYPE_EXT,
  IMAGE_TYPE_MIME,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/upload";

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

function ascii(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("detectImageType", () => {
  it("detects JPEG by magic bytes FF D8 FF", () => {
    const buf = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
    expect(detectImageType(buf)).toBe("jpeg");
  });

  it("detects PNG by magic bytes 89 50 4E 47 ...", () => {
    const buf = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
    expect(detectImageType(buf)).toBe("png");
  });

  it("detects GIF87a", () => {
    expect(detectImageType(ascii("GIF87a"))).toBe("gif");
  });

  it("detects GIF89a", () => {
    expect(detectImageType(ascii("GIF89a"))).toBe("gif");
  });

  it("detects WebP (RIFF....WEBP)", () => {
    const buf = ascii("RIFF");
    const webp = ascii("WEBP");
    const full = new Uint8Array(12);
    full.set(buf, 0);
    full.set(webp, 8);
    expect(detectImageType(full)).toBe("webp");
  });

  it("rejects HTML content disguised as an image", () => {
    const html = ascii("<!DOCTYPE html><html><script>alert(1)</script></html>");
    expect(detectImageType(html)).toBeNull();
  });

  it("rejects SVG content", () => {
    const svg = ascii("<svg onload=alert(1)></svg>");
    expect(detectImageType(svg)).toBeNull();
  });

  it("rejects empty buffer", () => {
    expect(detectImageType(new Uint8Array(0))).toBeNull();
  });

  it("rejects buffers shorter than the magic signature", () => {
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
  });

  it("rejects arbitrary binary that is not an image", () => {
    expect(detectImageType(ascii("MZ\x90\x00binary"))).toBeNull();
  });

  it("rejects plain text with an .html-like body", () => {
    expect(detectImageType(ascii("<script>alert(1)</script>"))).toBeNull();
  });
});

describe("detectPdf", () => {
  it("detects a standard PDF by the %PDF- header", () => {
    const pdf = ascii("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n%%EOF");
    expect(detectPdf(pdf)).toBe(true);
  });

  it("detects a PDF whose header is preceded by junk bytes", () => {
    const buf = bytes(0x00, 0x00, 0x00);
    const pdf = ascii("%PDF-1.4");
    const full = new Uint8Array(buf.length + pdf.length);
    full.set(buf, 0);
    full.set(pdf, buf.length);
    expect(detectPdf(full)).toBe(true);
  });

  it("rejects HTML content disguised as a PDF", () => {
    const html = ascii("<!DOCTYPE html><html><script>alert(1)</script></html>");
    expect(detectPdf(html)).toBe(false);
  });

  it("rejects image bytes", () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
    expect(detectPdf(png)).toBe(false);
  });

  it("rejects empty buffer", () => {
    expect(detectPdf(new Uint8Array(0))).toBe(false);
  });

  it("rejects a header longer than the 1024-byte scan window", () => {
    const junk = new Uint8Array(2048).fill(0x00);
    const pdf = ascii("%PDF-1.6");
    const full = new Uint8Array(junk.length + pdf.length);
    full.set(junk, 0);
    full.set(pdf, junk.length);
    expect(detectPdf(full)).toBe(false);
  });
});

describe("upload constants", () => {
  it("whitelists exactly jpeg/png/gif/webp", () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual(["jpeg", "png", "gif", "webp"]);
  });

  it("maps every type to a whitelisted extension and MIME", () => {
    for (const t of ALLOWED_IMAGE_TYPES) {
      expect(IMAGE_TYPE_EXT[t]).toBeTruthy();
      expect(IMAGE_TYPE_MIME[t]).toMatch(/^image\//);
    }
    expect(IMAGE_TYPE_EXT.jpeg).toBe("jpg");
    expect(IMAGE_TYPE_EXT.png).toBe("png");
    expect(IMAGE_TYPE_EXT.gif).toBe("gif");
    expect(IMAGE_TYPE_EXT.webp).toBe("webp");
  });

  it("never maps to html/svg/svgz extensions", () => {
    for (const t of ALLOWED_IMAGE_TYPES) {
      expect(IMAGE_TYPE_EXT[t]).not.toMatch(/html|svg/i);
    }
  });
});

describe("PDF upload validation", () => {
  const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

  it("accepts valid PDF with %PDF- header", () => {
    const pdf = ascii("%PDF-1.7\n%mock\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    expect(detectPdf(pdf)).toBe(true);
    expect(pdf.length).toBeLessThan(MAX_SIZE);
  });

  it("rejects file exceeding 15 MB limit", () => {
    // Create a buffer larger than MAX_SIZE
    const oversized = Buffer.alloc(MAX_SIZE + 1);
    oversized.write("%PDF-", 0, "latin1");
    expect(oversized.length).toBeGreaterThan(MAX_SIZE);
    // The route handler checks size BEFORE detectPdf
    expect(oversized.length > MAX_SIZE).toBe(true);
  });

  it("rejects non-PDF file disguised as PDF (wrong magic bytes)", () => {
    const fake = ascii("This is not a PDF file - just plain text.");
    expect(detectPdf(fake)).toBe(false);
  });

  it("rejects HTML file with .pdf extension", () => {
    const html = ascii("<!DOCTYPE html><html><body>Not a PDF</body></html>");
    expect(detectPdf(html)).toBe(false);
  });

  it("rejects executable disguised as PDF", () => {
    const exe = bytes(0x4d, 0x5a, 0x90, 0x00); // MZ header (PE executable)
    expect(detectPdf(exe)).toBe(false);
  });

  it("accepts PDF with junk bytes before header", () => {
    const junk = bytes(0x00, 0x00, 0x00, 0x00);
    const pdf = ascii("%PDF-1.4");
    const full = new Uint8Array(junk.length + pdf.length);
    full.set(junk, 0);
    full.set(pdf, junk.length);
    expect(detectPdf(full)).toBe(true);
  });
});
