import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(24, Math.max(1, Number(searchParams.get("limit") || "50")));
  const items = await db.achievement.findMany({
    orderBy: { date: "desc" },
    take: limit,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Judul prestasi wajib diisi." }, { status: 400 });
  }
  const item = await db.achievement.create({
    data: {
      title,
      description: body.description || null,
      studentName: body.studentName || null,
      level: String(body.level || "Kabupaten"),
      category: String(body.category || "Akademik"),
      date: body.date ? new Date(body.date) : new Date(),
    },
  });
  await logActivity(auth.user, "CREATE", "Achievement", `Menambah prestasi: ${title}`, item.id);
  return NextResponse.json(item);
}
