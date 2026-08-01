import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { hashPassword } from "@/lib/password";
import { createUserSchema, validateBody } from "@/lib/validations";

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
      guardianClassId: true,
      guardianClass: { select: { name: true } },
      createdAt: true,
    },
  });
  return NextResponse.json({
    items: items.map((u) => ({
      ...u,
      guardianClassName: u.guardianClass?.name ?? null,
      guardianClass: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createUserSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, email, password, role, guardianClassId } = validation.data;
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
  }
  const user = await db.user.create({
    data: {
      name,
      email,
      password: hashPassword(password),
      role,
      isActive: true,
      guardianClassId: role === "GURU" ? guardianClassId || null : null,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  await logActivity(auth.user, "CREATE", "User", `Menambah akun ${role}: ${name} (${email})`, user.id);
  return NextResponse.json(user);
}
