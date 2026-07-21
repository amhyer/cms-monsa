import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));
  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  const [total, items] = await Promise.all([
    db.complaint.count({ where }),
    db.complaint.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return NextResponse.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!subject || !message) {
      return NextResponse.json({ error: "Subjek dan pesan wajib diisi." }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ error: "Email atau telepon wajib diisi untuk respons." }, { status: 400 });
    }
    const isAnonymous = Boolean(body.isAnonymous);
    const item = await db.complaint.create({
      data: {
        name: isAnonymous ? "Anonim" : name || "Anonim",
        email: isAnonymous ? "-" : email || "-",
        phone: isAnonymous ? "-" : phone || "-",
        role: String(body.role || "Orang Tua"),
        category: String(body.category || "Akademik"),
        subject,
        message,
        isAnonymous,
        priority: body.priority === "TINGGI" ? "TINGGI" : "NORMAL",
      },
    });
    return NextResponse.json({ ok: true, id: item.id });
  } catch (e) {
    console.error("[complaint-create]", e);
    return NextResponse.json({ error: "Gagal mengirim pengaduan." }, { status: 500 });
  }
}
