import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPrisma } from "../test-utils";

/**
 * Route /api/favicon TIDAK boleh me-redirect ke origin publik
 * (NEXT_PUBLIC_SITE_URL): origin itu sering unreachable dari sisi server
 * (CI, self-host di jaringan tertutup) sehingga fetch internal — termasuk
 * warm-up E2E — gagal dengan "fetch failed". Semua respons selain URL
 * eksternal yang dikonfigurasi admin wajib same-origin.
 */

// vi.hoisted: factory vi.mock di-hoist ke atas file, jadi mock-nya harus
// dibuat lewat vi.hoisted agar bisa dirujuk dari dalam factory.
const { mockLoadUpload, mockReadFile } = vi.hoisted(() => ({
  mockLoadUpload: vi.fn(),
  mockReadFile: vi.fn(),
}));
vi.mock("@/lib/file-storage", () => ({
  loadUpload: (...args: unknown[]) => mockLoadUpload(...args),
}));

// Satu instance dipakai di named & default export — interop node builtin
// membuat route membaca lewat `default`.
vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  default: { readFile: mockReadFile },
}));

import { GET } from "@/app/api/favicon/route";

const LOGO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
const REQ = new Request("http://localhost:3000/api/favicon");

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINAL_SITE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
  }
});

function stubLogoFile() {
  mockReadFile.mockResolvedValue(Buffer.from(LOGO_SVG));
}

describe("GET /api/favicon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadUpload.mockResolvedValue(null);
    // Kunci regresi: env menunjuk origin publik yang unreachable —
    // route tetap wajib same-origin dalam semua skenario di bawah.
    process.env.NEXT_PUBLIC_SITE_URL = "https://sdn-mongisidi1.sch.id";
    stubLogoFile();
  });

  it("tanpa konfigurasi → melayani logo.svg same-origin (200, bukan redirect keluar-origin)", async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({ faviconUrl: null });

    const res = await GET(REQ);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).toBe(LOGO_SVG);
  });

  it("query DB gagal → tetap melayani logo.svg same-origin (jaring pengaman)", async () => {
    mockPrisma.siteSetting.findUnique.mockRejectedValue(new Error("db down"));

    const res = await GET(REQ);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("location")).toBeNull();
  });

  it("faviconUrl eksternal (http/https) → redirect ke URL tersebut", async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      faviconUrl: "https://cdn.contoh.id/favicon.ico",
    });

    const res = await GET(REQ);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://cdn.contoh.id/favicon.ico");
  });

  it("faviconUrl relatif → redirect same-origin, bukan ke NEXT_PUBLIC_SITE_URL", async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({ faviconUrl: "/icon.svg" });

    const res = await GET(REQ);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/icon.svg");
  });

  it("faviconUrl /uploads/ → melayani file dari storage (200)", async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({ faviconUrl: "/uploads/favicon.png" });
    mockLoadUpload.mockResolvedValue({
      data: Buffer.from("png-bytes"),
      mimeType: "image/png",
      size: 9,
      etag: '"e2e"',
    });

    const res = await GET(REQ);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await res.text()).toBe("png-bytes");
  });

  it("file upload hilang dari storage → redirect same-origin ke path-nya", async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue({ faviconUrl: "/uploads/hilang.png" });
    mockLoadUpload.mockResolvedValue(null);

    const res = await GET(REQ);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/uploads/hilang.png");
  });
});
