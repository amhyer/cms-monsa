import { NextRequest, NextResponse } from "next/server";
import { unlink, readFile } from "fs/promises";
import { join, basename } from "path";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Unduh dokumen pendukung (output ARKAS / bukti belanja BOS). PUBLIK —
 * transparansi anggaran memang untuk dilihat semua orang. File disajikan
 * dengan header Content-Disposition: attachment agar browser mengunduh
 * (nama file asli), bukan membuka inline di tab baru.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const doc = await db.bosDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }

  const filename = basename(doc.fileUrl);
  try {
    const bytes = await readFile(join(process.cwd(), "public", "uploads", filename));
    const safeName = doc.fileName.replace(/["\\\r\n]/g, "_");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // File di disk hilang (row ada) — 404 agar konsisten dengan DELETE yatim.
    return NextResponse.json(
      { error: "File dokumen tidak ditemukan di server." },
      { status: 404 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const existing = await db.bosDocument.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }

  await db.bosDocument.delete({ where: { id } });

  // Hapus file dari disk (best-effort — file yatim tidak memblokir hapus data).
  try {
    const filename = basename(existing.fileUrl);
    await unlink(join(process.cwd(), "public", "uploads", filename));
  } catch {
    // file sudah tidak ada — abaikan
  }

  await logActivity(
    auth.user,
    "DELETE",
    "BosDocument",
    `Menghapus dokumen transparansi ${existing.year}: ${existing.title}`,
    id
  );
  return NextResponse.json({ ok: true });
}
