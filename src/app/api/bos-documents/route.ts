import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { rateLimitPublicGet } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log";
import { createBosDocumentSchema, validateBody } from "@/lib/validations";
import { detectPdf } from "@/lib/upload";

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB — output ARKAS bisa berisi banyak halaman

/**
 * Sumber permintaan untuk jejak audit: asal (Origin) + IP klien (bila
 * disediakan proxy). Dipakai di log unggahan — diterima, ditolak, maupun gagal.
 */
function requestSource(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : req.headers.get("x-real-ip");
  const origin = req.headers.get("origin");
  const parts = [
    origin ? `origin=${origin}` : "origin=-",
    ip ? `ip=${ip}` : "ip=-",
  ];
  return parts.join(" ");
}

/**
 * Dokumen pendukung transparansi — output ARKAS / bukti belanja BOS (PDF).
 * GET bersifat PUBLIK (transparansi anggaran memang untuk dilihat semua
 * orang); POST dibatasi khusus Super Admin.
 */
export async function GET(req: NextRequest) {
  // Rate limit: max 60 requests per minute per IP (public document list)
  const rateLimited = await rateLimitPublicGet(req, 60, 60000);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));
  const where = year ? { year: Number(year) } : {};

  const [total, rows, yearRows] = await Promise.all([
    db.bosDocument.count({ where }),
    db.bosDocument.findMany({
      where,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: { uploadedBy: { select: { name: true } } },
    }),
    db.bosDocument.findMany({
      distinct: ["year"],
      select: { year: true },
      orderBy: { year: "desc" },
    }),
  ]);

  return NextResponse.json({
    items: rows.map((d) => ({
      id: d.id,
      year: d.year,
      title: d.title,
      description: d.description,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      fileSize: d.fileSize,
      uploadedByName: d.uploadedBy?.name ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    years: yearRows.map((r) => r.year),
  });
}

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;

  // Nama file coba-unggah (bisa null bila body rusak / tidak ada file) —
  // dicatat di setiap cabang (diterima, ditolak, gagal) untuk jejak audit.
  let attemptedName: string | null = null;
  let attemptedSize = 0;
  const source = requestSource(req);

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    attemptedName = file instanceof File ? file.name : null;
    attemptedSize = file instanceof File ? file.size : 0;

    if (!file || !(file instanceof File)) {
      console.warn("[bos-documents] unggahan ditolak", {
        reason: "file-tidak-ada",
        filename: attemptedName,
        source,
      });
      return NextResponse.json(
        { error: "File tidak ditemukan. Pilih file PDF yang akan diunggah." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      console.warn("[bos-documents] unggahan ditolak", {
        reason: "terlalu-besar",
        filename: attemptedName,
        size: file.size,
        source,
      });
      return NextResponse.json(
        { error: "Ukuran file maksimal 15 MB." },
        { status: 400 }
      );
    }

    // SECURITY: jangan pernah percaya `file.type` (client-controlled) atau
    // ekstensi `file.name` (attacker-controlled). Deteksi isi file dari magic
    // bytes ("%PDF-") dan paksa ekstensi .pdf — yang lain ditolak.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!detectPdf(bytes)) {
      console.warn("[bos-documents] unggahan ditolak", {
        reason: "bukan-pdf",
        filename: attemptedName,
        size: file.size,
        source,
      });
      return NextResponse.json(
        {
          error:
            "Isi file bukan PDF yang valid. Gunakan file PDF (output ARKAS / bukti belanja).",
        },
        { status: 400 }
      );
    }

    const validation = validateBody(
      createBosDocumentSchema,
      {
        year: Number(formData.get("year")),
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? "").trim() || null,
      }
    );
    if (!validation.ok) {
      console.warn("[bos-documents] unggahan ditolak", {
        reason: "validasi-gagal",
        filename: attemptedName,
        size: file.size,
        source,
        error: validation.error,
      });
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { year, title, description } = validation.data;

    const filename = `bos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), Buffer.from(bytes));

    const doc = await db.bosDocument.create({
      data: {
        year,
        title,
        description: description || null,
        fileUrl: `/uploads/${filename}`,
        fileName: file.name || filename,
        fileSize: file.size,
        uploadedById: auth.user.id,
      },
    });
    await logActivity(
      auth.user,
      "CREATE",
      "BosDocument",
      `Mengunggah dokumen transparansi ${year}: ${title} (file: ${doc.fileName})`,
      doc.id
    );
    console.info("[bos-documents] unggahan diterima", {
      filename: doc.fileName,
      size: doc.fileSize,
      source,
      id: doc.id,
    });
    return NextResponse.json(doc);
  } catch (e) {
    console.error("[bos-documents] upload failed", {
      filename: attemptedName,
      size: attemptedSize,
      source,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Gagal mengunggah dokumen. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
