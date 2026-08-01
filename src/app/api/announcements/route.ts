import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { createAnnouncementSchema, validateBody } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "public";

  if (scope === "admin") {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const items = await db.announcement.findMany({
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ items });
  }

  // public: active, not expired, pinned first
  const now = new Date();
  const items = await db.announcement.findMany({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 20,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createAnnouncementSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title, content } = validation.data;
  const item = await db.announcement.create({
    data: {
      title,
      content,
      isPinned: Boolean(body.isPinned),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: body.isActive !== false,
    },
  });
  await logActivity(auth.user, "CREATE", "Announcement", `Menerbitkan pengumuman: ${title}`, item.id);
  return NextResponse.json(item);
}
