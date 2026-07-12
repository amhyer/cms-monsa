import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "public";
  // scope=admin returns ALL teachers (incl. inactive) — requires auth.
  if (scope === "admin") {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const items = await db.teacher.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ items });
  }
  // public: only active teachers.
  const items = await db.teacher.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
  }
  const count = await db.teacher.count();
  const item = await db.teacher.create({
    data: {
      name,
      position: String(body.position ?? ""),
      subject: body.subject || null,
      education: body.education || null,
      photo: body.photo || null,
      order: Number(body.order ?? count),
      isActive: body.isActive !== false,
    },
  });
  await logActivity(auth.user, "CREATE", "Teacher", `Menambah data guru/staf: ${name}`, item.id);
  return NextResponse.json(item);
}
