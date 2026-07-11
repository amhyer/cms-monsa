import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const where: Record<string, unknown> = {};
  if (category && category !== "all") where.category = category;
  if (type && type !== "all") where.type = type;
  const items = await db.galleryItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const url = String(body.url ?? "").trim();
  if (!title || !url) {
    return NextResponse.json({ error: "Judul dan URL media wajib diisi." }, { status: 400 });
  }
  const item = await db.galleryItem.create({
    data: {
      title,
      description: body.description || null,
      type: body.type === "VIDEO" ? "VIDEO" : "PHOTO",
      url,
      thumbnail: body.thumbnail || null,
      category: String(body.category || "Kegiatan"),
    },
  });
  await logActivity(auth.user, "CREATE", "Gallery", `Menambah media galeri: ${title}`, item.id);
  return NextResponse.json(item);
}
