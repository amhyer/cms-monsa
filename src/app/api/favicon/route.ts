import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadUpload } from "@/lib/file-storage";

/**
 * Dynamic favicon route — serves the favicon configured in SiteSetting.
 *
 * Flow:
 * 1. Read faviconUrl from SiteSetting singleton.
 * 2. If it's a /uploads/<filename> path, load from storage and serve.
 * 3. If it's an external URL (http/https), redirect to it.
 * 4. If no favicon is configured, serve the default /logo.svg.
 */
export async function GET() {
  try {
    const settings = await db.siteSetting.findUnique({
      where: { id: "singleton" },
      select: { faviconUrl: true },
    });

    const faviconUrl = settings?.faviconUrl;

    // No custom favicon — serve default logo.svg
    if (!faviconUrl) {
      return NextResponse.redirect(new URL("/logo.svg", process.env.NEXT_PUBLIC_SITE_URL || "https://cms-monsa-l7qg.vercel.app"));
    }

    // External URL — redirect
    if (faviconUrl.startsWith("http://") || faviconUrl.startsWith("https://")) {
      return NextResponse.redirect(faviconUrl);
    }

    // Local upload path — load from storage
    if (faviconUrl.startsWith("/uploads/")) {
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

    // Fallback — redirect to the URL as-is (could be a relative path like /logo.svg)
    return NextResponse.redirect(new URL(faviconUrl, process.env.NEXT_PUBLIC_SITE_URL || "https://cms-monsa-l7qg.vercel.app"));
  } catch {
    // On error, serve default logo
    return NextResponse.redirect(new URL("/logo.svg", process.env.NEXT_PUBLIC_SITE_URL || "https://cms-monsa-l7qg.vercel.app"));
  }
}
