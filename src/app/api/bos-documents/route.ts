import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { requireCsrf } from "@/lib/csrf";
import { rateLimitPublicGet } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log";
import { createBosDocumentSchema, validateBody } from "@/lib/validations";
import { detectPdf } from "@/lib/upload";
import { saveUpload, maxUploadMb } from "@/lib/file-storage";
import {
  parsePaginationParams,
  decodeCursor,
  buildPaginatedResponse,
} from "@/lib/pagination";

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
  const { cursor, limit } = parsePaginationParams(searchParams, 10, 100);
  const cursorId = decodeCursor(cursor);
  const baseWhere = year ? { year: Number(year) } : {};
  const where = {
    ...baseWhere,
    ...(cursorId ? { id: { gt: cursorId } } : {}),
  };

  const [total, rows, yearRows] = await Promise.all([
    db.bosDocument.count({ where: baseWhere }),
    db.bosDocument.findMany({
      where,
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      include: { uploadedBy: { select: { name: true } } },
    }),
    db.bosDocument.findMany({
      distinct: ["year"],
      select: { year: true },
      orderBy: { year: "desc" },
    }),
  ]);

  const mapped = rows.map((d) => ({
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
  }));

  return NextResponse.json({
    ...buildPaginatedResponse(mapped, total, limit),
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
      logger.warn({
        reason: "file-tidak-ada",
        filename: attemptedName,
        source,
      });
      return NextResponse.json(
        { error: "File tidak ditemukan. Pilih file PDF yang akan diunggah." },
        { status: 400 }
      );
    }
    // Batas ukuran — sadar-platform: Vercel membatasi request body 4.5 MB di
    // level platform (tidak bisa dinaikkan), jadi batas route di sana 4 MB
    // agar penolakan terjadi dengan pesan 400 yang jelas. Self-host (Docker)
    // tetap 15 MB — output ARKAS bisa berisi banyak halaman.
    const maxMb = maxUploadMb(15);
    const MAX_SIZE = maxMb * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      logger.warn({
        reason: "terlalu-besar",
        filename: attemptedName,
        size: file.size,
        source,
      });
      return NextResponse.json(
        { error: `Ukuran file maksimal ${maxMb} MB.` },
        { status: 400 }
      );
    }

    // SECURITY: jangan pernah percaya `file.type` (client-controlled) atau
    // ekstensi `file.name` (attacker-controlled). Deteksi isi file dari magic
    // bytes ("%PDF-") dan paksa ekstensi .pdf — yang lain ditolak.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!detectPdf(bytes)) {
      logger.warn({
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
      logger.warn({
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
    // Simpan ke backend aktif (disk self-host / tabel UploadedFile di Vercel)
    // — lihat src/lib/file-storage.ts.
    await saveUpload(bytes, filename, "application/pdf");

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
    logger.info({ filename: doc.fileName, size: doc.fileSize, source, id: doc.id }, "[bos-documents] unggahan diterima");
    return NextResponse.json(doc);
  } catch (e) {
    logger.error(
      {
        filename: attemptedName,
        size: attemptedSize,
        source,
        error: e instanceof Error ? e.message : String(e),
      },
      "[bos-documents] upload failed"
    );
    return NextResponse.json(
      { error: "Gagal mengunggah dokumen. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
