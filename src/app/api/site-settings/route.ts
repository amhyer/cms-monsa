import { safeJson, withErrorHandling } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { logger } from "@/lib/logger";

/**
 * GET /api/site-settings — fetch school settings (public, cached).
 * Cache: 1 hour (public data, admin can update anytime).
 */
async function GET_impl() {
  let settings = await db.siteSetting.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    settings = await db.siteSetting.create({
      data: {
        id: "singleton",
        vision: "",
        mission: "",
        history: "",
        principalWelcome: "",
        spmbInfo: "",
      },
    });
  }
  const res = NextResponse.json(settings);
  // Public data, cached for 1 hour; stale-while-revalidate for 2 hours
  res.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=7200"
  );
  return res;
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const GET = withErrorHandling(GET_impl, { errorMessage: "Gagal memuat pengaturan situs." });

/**
 * PUT /api/site-settings — update school settings (admin only, no cache).
 */
export async function PUT(req: Request) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const parsed = await safeJson(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const data = {
      schoolName: String(body.schoolName ?? ""),
      npsn: String(body.npsn ?? ""),
      logo: body.logo ?? null,
      faviconUrl: body.faviconUrl ?? null,
      address: String(body.address ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      mapEmbed: body.mapEmbed ?? null,
      vision: String(body.vision ?? ""),
      mission: String(body.mission ?? ""),
      history: String(body.history ?? ""),
      principalName: String(body.principalName ?? ""),
      principalPhoto: body.principalPhoto ?? null,
      principalWelcome: String(body.principalWelcome ?? ""),
      facebook: body.facebook ?? null,
      instagram: body.instagram ?? null,
      youtube: body.youtube ?? null,
      tiktok: body.tiktok ?? null,
      studentCount: Number(body.studentCount ?? 0) || 0,
      teacherCount: Number(body.teacherCount ?? 0) || 0,
      facilityCount: Number(body.facilityCount ?? 0) || 0,
      achievementCount: Number(body.achievementCount ?? 0) || 0,
      spmbInfo: String(body.spmbInfo ?? ""),
      spmbLink: body.spmbLink || null,
    };

    const updated = await db.siteSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    await logActivity(
      auth.user,
      "UPDATE",
      "SiteSetting",
      "Memperbarui pengaturan situs sekolah"
    );

    return NextResponse.json(updated);
  } catch (e) {
    logger.error({ err: e }, "[site-settings] PUT error");
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan situs." },
      { status: 500 }
    );
  }
}
