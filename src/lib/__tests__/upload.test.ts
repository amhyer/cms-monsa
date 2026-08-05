import { describe, it, expect } from "vitest";
import {
  detectImageType,
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
