import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { createTeacherSchema, validateBody } from "@/lib/validations";

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
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createTeacherSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, subject, bio, imageUrl, order } = validation.data;
  const count = await db.teacher.count();
  const item = await db.teacher.create({
    data: {
      name,
      position: body.position || "",
      subject: subject || null,
      education: bio || null,
      photo: imageUrl || null,
      // Identitas Dapodik — diisi otomatis oleh sync, atau manual oleh operator.
      nuptk: body.nuptk ? String(body.nuptk).trim() || null : null,
      nip: body.nip ? String(body.nip).trim() || null : null,
      order: order ?? count,
      isActive: body.isActive !== false,
    },
  });
  await logActivity(auth.user, "CREATE", "Teacher", `Menambah data guru/staf: ${name}`, item.id);
  return NextResponse.json(item);
}
