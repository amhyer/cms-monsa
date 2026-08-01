import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { parseDateInput } from "@/lib/format";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));

  const [total, items] = await Promise.all([
    db.achievement.count(),
    db.achievement.findMany({
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

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
      date: body.date ? parseDateInput(String(body.date)) : new Date(),
    },
  });
  await logActivity(auth.user, "CREATE", "Achievement", `Menambah prestasi: ${title}`, item.id);
  return NextResponse.json(item);
}
