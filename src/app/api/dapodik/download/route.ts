import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Platform = "windows" | "macos" | "linux";

const GITHUB_REPO = "amhyer/cms-monsa";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Download jembatan executable from GitHub Releases
 */
async function getLatestReleaseUrl(platform: Platform): Promise<string | null> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CMS-MONSA-Jembatan",
      },
    });

    if (!res.ok) {
      console.error("[jembatan-download] GitHub API error:", res.status);
      return null;
    }

    const release = await res.json();
    const assets = release.assets || [];

    // Map platform to asset name pattern
    const patterns: Record<Platform, string[]> = {
      windows: ["Jembatan-Dapodik.exe", "windows", ".exe"],
      macos: ["Jembatan-Dapodik-macos", "macos", "-macos"],
      linux: ["Jembatan-Dapodik-linux", "linux", "-linux"],
    };

    const targetPatterns = patterns[platform];

    for (const asset of assets) {
      const name = asset.name.toLowerCase();
      const matches = targetPatterns.some((p) => name.includes(p.toLowerCase()));
      if (matches && asset.browser_download_url) {
        return asset.browser_download_url;
      }
    }

    console.log("[jembatan-download] No matching asset found for platform:", platform);
    return null;
  } catch (err) {
    console.error("[jembatan-download] Error fetching release:", err);
    return null;
  }
}

/** Unduh aplikasi jembatan dari GitHub Releases. */
export async function GET(req: NextRequest) {
  // Cek autentikasi
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  // Parse platform
  const url = new URL(req.url);
  const platformParam = url.searchParams.get("platform");
  
  let platform: Platform = "windows";
  
  if (platformParam === "macos" || platformParam === "linux") {
    platform = platformParam;
  } else {
    // Detect dari User-Agent
    const userAgent = req.headers.get("user-agent") || "";
    if (userAgent.toLowerCase().includes("mac")) {
      platform = "macos";
    } else if (userAgent.toLowerCase().includes("linux")) {
      platform = "linux";
    }
  }

  // Get download URL from GitHub
  const downloadUrl = await getLatestReleaseUrl(platform);

  if (downloadUrl) {
    // Redirect to GitHub download
    return NextResponse.redirect(downloadUrl);
  }

  // Fallback: Return instructions if no release found
  return NextResponse.json(
    {
      error: "File executable belum tersedia di GitHub Releases",
      message: `Silakan download manual dari GitHub Releases:\n\nhttps://github.com/${GITHUB_REPO}/releases/latest\n\nAtau hubungi administrator untuk petunjuk lebih lanjut.`,
      githubRepo: GITHUB_REPO,
      githubReleases: `https://github.com/${GITHUB_REPO}/releases`,
      platform,
    },
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
