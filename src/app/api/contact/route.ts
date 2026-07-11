import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Nama, email, subjek, dan pesan wajib diisi." },
        { status: 400 }
      );
    }
    const item = await db.contactMessage.create({
      data: {
        name,
        email,
        phone: body.phone ? String(body.phone) : null,
        subject,
        message,
      },
    });
    return NextResponse.json({ ok: true, id: item.id });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json({ error: "Gagal mengirim pesan." }, { status: 500 });
  }
}
