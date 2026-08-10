import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { createOrgStructureSchema, validateBody } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "public";
  // scope=admin returns ALL entries (incl. inactive) — requires auth.
  if (scope === "admin") {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const items = await db.orgStructure.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ items });
  }
  // public: only active entries (struktur organisasi di website).
  const items = await db.orgStructure.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const validation = validateBody(createOrgStructureSchema, body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, position, photo, order, isActive } = validation.data;
  const count = await db.orgStructure.count();
  const item = await db.orgStructure.create({
    data: {
      name,
      position,
      photo: photo || null,
      order: order ?? count,
      isActive,
    },
  });
  await logActivity(auth.user, "CREATE", "OrgStructure", `Menambah struktur organisasi: ${name}`, item.id);
  return NextResponse.json(item);
}