import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { parseDateInput } from "@/lib/format";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upcoming = searchParams.get("upcoming");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (category && category !== "all") where.category = category;
  if (upcoming === "true") where.date = { gte: new Date() };

  const items = await db.agenda.findMany({
    where,
    orderBy: { date: "asc" },
    take: upcoming === "true" ? 10 : undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Nama kegiatan wajib diisi." }, { status: 400 });
  }
  if (!body.date) {
    return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
  }
  const item = await db.agenda.create({
    data: {
      title,
      description: body.description || null,
      date: parseDateInput(String(body.date)),
      time: body.time || null,
      location: body.location || null,
      category: String(body.category || "Umum"),
    },
  });
  await logActivity(auth.user, "CREATE", "Agenda", `Menjadwalkan agenda: ${title}`, item.id);
  return NextResponse.json(item);
}
