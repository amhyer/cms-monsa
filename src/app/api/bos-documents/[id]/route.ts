import { NextRequest, NextResponse } from "next/server";
import { basename } from "path";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { loadUpload, deleteUpload } from "@/lib/file-storage";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Unduh dokumen pendukung (output ARKAS / bukti belanja BOS). PUBLIK —
 * transparansi anggaran memang untuk dilihat semua orang. File disajikan
 * dengan header Content-Disposition: attachment agar browser mengunduh
 * (nama file asli), bukan membuka inline di tab baru.
 *
 * Sumber file: backend aktif (disk self-host / tabel UploadedFile di Vercel)
 * via loadUpload — lihat src/lib/file-storage.ts.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const doc = await db.bosDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  }

  const filename = basename(doc.fileUrl);
  const file = await loadUpload(filename);
  if (!file) {
    // File tidak ada di disk maupun DB (row ada) — 404 agar konsisten
    // dengan DELETE yatim.
    return NextResponse.json(
      { error: "File dokumen tidak ditemukan di server." },
      { status: 404 }
    );
  }
  const safeName = doc.fileName.replace(/["\\\r\n]/g, "_");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Content-Length": String(file.size),
      "Cache-Control": "no-store",
    },
  });
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

  // Hapus file dari backend aktif (disk + DB, best-effort — file yatim
  // tidak memblokir hapus data). Lihat src/lib/file-storage.ts.
  try {
    const filename = basename(existing.fileUrl);
    await deleteUpload(filename);
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
