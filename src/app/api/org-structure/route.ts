import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { omitFields } from "@/lib/utils";
import { PUBLIC_ORG_STRUCTURE_OMIT } from "@/lib/public-scope";
import { createOrgStructureSchema, validateBody } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "public";
    // scope=admin returns ALL entries (incl. inactive) — requires auth.
    // Pagination server-side (page/limit) + pencarian (q) mengikuti pola
    // /api/users agar manager tidak memuat seluruh daftar sekaligus.
    if (scope === "admin") {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;
      const page = Math.max(1, Number(searchParams.get("page") || "1"));
      const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || "10")));
      const q = searchParams.get("q")?.trim() || "";
      const where = q
        ? {
            OR: [{ name: { contains: q } }, { position: { contains: q } }],
          }
        : {};
      const [total, items] = await Promise.all([
        db.orgStructure.count({ where }),
        db.orgStructure.findMany({
          where,
          orderBy: [{ order: "asc" }, { name: "asc" }],
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
    // public: only active entries (struktur organisasi di website).
    // Identitas (NUPTK/NIP/NIK) tidak pernah keluar dari scope admin.
    const items = await db.orgStructure.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({
      items: items.map((item) => omitFields(item, PUBLIC_ORG_STRUCTURE_OMIT)),
    });
  } catch (error) {
    console.error("[org-structure] GET error:", error);
    return NextResponse.json(
      { items: [], error: "Gagal memuat data struktur organisasi." },
      { status: 500 }
    );
  }
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

  const { name, position, photo, nuptk, nip, nik, bio, contact, order, isActive } =
    validation.data;
  const count = await db.orgStructure.count();
  const item = await db.orgStructure.create({
    data: {
      name,
      position,
      photo: photo || null,
      nuptk: nuptk || null,
      nip: nip || null,
      nik: nik || null,
      bio: bio || null,
      contact: contact || null,
      order: order ?? count,
      isActive,
    },
  });
  await logActivity(auth.user, "CREATE", "OrgStructure", `Menambah struktur organisasi: ${name}`, item.id);
  return NextResponse.json(item);
}