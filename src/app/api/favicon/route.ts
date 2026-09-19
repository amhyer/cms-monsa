import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadUpload } from "@/lib/file-storage";

/**
 * Dynamic favicon route — serves the favicon configured in SiteSetting.
 *
 * Flow:
 * 1. Read faviconUrl from SiteSetting singleton.
 * 2. External URL (http/https) → redirect ke URL tersebut (satu-satunya
 *    jalur keluar-origin, dan hanya bila admin sengaja mengonfigurasinya).
 * 3. Path upload lokal (/uploads/<file>) → melayani dari storage.
 * 4. Path relatif lain → redirect same-origin (dihitung dari req.url).
 * 5. Tidak dikonfigurasi / file storage hilang / error → melayani
 *    /logo.svg bawaan langsung dari disk, same-origin, tanpa redirect.
 *
 * Kenapa tidak me-redirect ke `${NEXT_PUBLIC_SITE_URL}/logo.svg`: env itu
 * adalah origin publik produksi (mis. domain sekolah) yang sering tidak
 * reachable dari sisi server — CI, self-host di jaringan tertutup, atau
 * saat domain sedang mati. Redirect keluar-origin membuat fetch internal
 * (warm-up E2E, crawler, cron) gagal dengan "fetch failed" dan memaksa
 * browser melakukan request ganda. Melayani file langsung dari route ini
 * selalu same-origin dan tidak bergantung pada env eksternal.
 */
export async function GET(req: Request) {
  try {
    const settings = await db.siteSetting.findUnique({
      where: { id: "singleton" },
      select: { faviconUrl: true },
    });

    const faviconUrl = settings?.faviconUrl;

    // External URL — redirect
    if (
      faviconUrl &&
      (faviconUrl.startsWith("http://") || faviconUrl.startsWith("https://"))
    ) {
      return NextResponse.redirect(faviconUrl);
    }

    // Local upload path — load from storage
    if (faviconUrl?.startsWith("/uploads/")) {
      const filename = faviconUrl.replace("/uploads/", "");
      const file = await loadUpload(filename);
      if (file) {
        return new NextResponse(new Uint8Array(file.data), {
          status: 200,
          headers: {
            "Content-Type": file.mimeType,
            "Content-Length": String(file.size),
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            ETag: file.etag,
          },
        });
      }
    }

    // Path relatif lain — redirect same-origin (bukan ke origin publik).
    if (faviconUrl) {
      return NextResponse.redirect(new URL(faviconUrl, req.url));
    }

    return serveDefaultLogo();
  } catch {
    // On error, serve default logo (same-origin; redirect ke path absolut
    // hanya sebagai jaring pengaman bila pembacaan file pun gagal).
    try {
      return await serveDefaultLogo();
    } catch {
      return NextResponse.redirect(new URL("/logo.svg", req.url));
    }
  }
}

/** Baca /logo.svg dari disk dan melayani langsung — same-origin, tanpa redirect. */
async function serveDefaultLogo(): Promise<Response> {
  const logo = await readFile(path.join(process.cwd(), "public", "logo.svg"));
  return new NextResponse(new Uint8Array(logo), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Length": String(logo.byteLength),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
