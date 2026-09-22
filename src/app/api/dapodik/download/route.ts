import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Platform = "windows" | "macos" | "linux";

const GITHUB_REPO = "amhyer/cms-monsa";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

/**
 * Download jembatan executable from GitHub Releases
 * Fetch all releases (including pre-releases) and find matching asset
 */
async function getLatestReleaseUrl(platform: Platform): Promise<string | null> {
  try {
    // Fetch all releases, including pre-releases
    const res = await fetch(GITHUB_API, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CMS-MONSA-Jembatan",
      },
    });

    if (!res.ok) {
      logger.error({ status: res.status }, "[jembatan-download] GitHub API error");
      return null;
    }

    const releases = await res.json();
    
    if (!Array.isArray(releases) || releases.length === 0) {
      logger.info("[jembatan-download] No releases found");
      return null;
    }

    // Map platform to asset name pattern
    const patterns: Record<Platform, string[]> = {
      windows: ["Jembatan-Dapodik.exe", "windows", ".exe"],
      macos: ["Jembatan-Dapodik-macos", "macos", "-macos"],
      linux: ["Jembatan-Dapodik-linux", "linux", "-linux"],
    };

    const targetPatterns = patterns[platform];

    // Search through all releases
    for (const release of releases) {
      const assets = release.assets || [];
      
      for (const asset of assets) {
        const name = asset.name.toLowerCase();
        const matches = targetPatterns.some((p) => name.includes(p.toLowerCase()));
        if (matches && asset.browser_download_url) {
          logger.info({ asset: asset.name, release: release.tag_name }, "[jembatan-download] Found asset");
          return asset.browser_download_url;
        }
      }
    }

    logger.warn({ platform }, "[jembatan-download] No matching asset found");
    return null;
  } catch (err) {
    logger.error({ err }, "[jembatan-download] Error fetching release");
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
    logger.info({ downloadUrl }, "[jembatan-download] Redirecting");
    return NextResponse.redirect(downloadUrl);
  }

  // Fallback: Return instructions if no release found
  return NextResponse.json(
    {
      error: "File executable belum tersedia di GitHub Releases",
      message: `Silakan download manual dari GitHub Releases:\n\nhttps://github.com/${GITHUB_REPO}/releases\n\nAtau hubungi administrator untuk petunjuk lebih lanjut.`,
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
