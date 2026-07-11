import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

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
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Judul wajib diisi." }, { status: 400 });
  }
  const item = await db.announcement.create({
    data: {
      title,
      content: String(body.content ?? ""),
      isPinned: Boolean(body.isPinned),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: body.isActive !== false,
    },
  });
  await logActivity(auth.user, "CREATE", "Announcement", `Menerbitkan pengumuman: ${title}`, item.id);
  return NextResponse.json(item);
}
