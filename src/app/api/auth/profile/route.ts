import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const user = await db.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
    }
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email tidak boleh kosong." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }
    // Check if email is already taken by another user
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== auth.user.id) {
      return NextResponse.json({ error: "Email sudah digunakan." }, { status: 409 });
    }
    data.email = email;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada data yang diupdate." }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: auth.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await logActivity(auth.user, "UPDATE", "Auth", "Memperbarui profil sendiri");

  return NextResponse.json(updated);
}
