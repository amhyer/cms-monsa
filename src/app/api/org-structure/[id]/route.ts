import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { omitFields } from "@/lib/utils";
import { PUBLIC_ORG_STRUCTURE_OMIT } from "@/lib/public-scope";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const item = await db.orgStructure.findUnique({ where: { id } });
  if (!item || !item.isActive) {
    return NextResponse.json({ error: "Struktur organisasi tidak ditemukan." }, { status: 404 });
  }
  // Publik: identitas (NUPTK/NIP/NIK) tidak pernah keluar dari scope admin.
  return NextResponse.json({ item: omitFields(item, PUBLIC_ORG_STRUCTURE_OMIT) });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.orgStructure.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }
  const body = await req.json();
  const updated = await db.orgStructure.update({
    where: { id },
    data: {
      name: String(body.name ?? existing.name),
      position: typeof body.position === "string" ? body.position : existing.position,
      photo: body.photo !== undefined ? body.photo || null : existing.photo,
      nuptk: body.nuptk !== undefined ? body.nuptk || null : existing.nuptk,
      nip: body.nip !== undefined ? body.nip || null : existing.nip,
      nik: body.nik !== undefined ? body.nik || null : existing.nik,
      bio: body.bio !== undefined ? body.bio || null : existing.bio,
      contact: body.contact !== undefined ? body.contact || null : existing.contact,
      order: Number(body.order ?? existing.order),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
    },
  });
  await logActivity(auth.user, "UPDATE", "OrgStructure", `Memperbarui struktur organisasi: ${updated.name}`, id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.orgStructure.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
  }
  await db.orgStructure.delete({ where: { id } });
  await logActivity(auth.user, "DELETE", "OrgStructure", `Menghapus struktur organisasi: ${existing.name}`, id);
  return NextResponse.json({ ok: true });
}