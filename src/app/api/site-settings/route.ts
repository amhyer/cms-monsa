import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { withCache } from "@/lib/cache";
import { logActivity } from "@/lib/log";

export async function GET() {
  let settings = await db.siteSetting.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    settings = await db.siteSetting.create({ data: { id: "singleton", vision: "", mission: "", history: "", principalWelcome: "", spmbInfo: "" } });
  }
  return withCache(NextResponse.json(settings), "public, s-maxage=3600, stale-while-revalidate=7200");
}

export async function PUT(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const data = {
    schoolName: String(body.schoolName ?? ""),
    npsn: String(body.npsn ?? ""),
    logo: body.logo ?? null,
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

  await logActivity(auth.user, "UPDATE", "SiteSetting", "Memperbarui pengaturan situs sekolah");

  return NextResponse.json(updated);
}
