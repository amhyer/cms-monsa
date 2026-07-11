import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/log";

export async function GET() {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const items = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = body.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "OPERATOR";

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nama, email, dan password wajib diisi." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password minimal 6 karakter." },
      { status: 400 }
    );
  }
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
  }
  const user = await db.user.create({
    data: { name, email, password, role, isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  await logActivity(auth.user, "CREATE", "User", `Menambah akun ${role}: ${name} (${email})`, user.id);
  return NextResponse.json(user);
}
