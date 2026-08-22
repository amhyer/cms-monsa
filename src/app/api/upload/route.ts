import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { detectImageType, IMAGE_TYPE_EXT } from "@/lib/upload";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "File tidak ditemukan. Pilih file yang akan diunggah." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 5 MB." },
        { status: 400 }
      );
    }

    // SECURITY (C2): never trust `file.type` (client-controlled) or the
    // extension in `file.name` (attacker-controlled). Detect the real image
    // type from the file content (magic bytes) and force the whitelisted
    // extension from that detection. Anything else — including HTML/SVG
    // disguised with an image MIME or .html/.svg name — is rejected.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImageType(bytes);
    if (!detected) {
      return NextResponse.json(
        {
          error:
            "Isi file bukan gambar yang diizinkan. Gunakan JPG, PNG, GIF, atau WebP.",
        },
        { status: 400 }
      );
    }

    const ext = IMAGE_TYPE_EXT[detected];
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Save to public/uploads
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), Buffer.from(bytes));

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e) {
    logger.error({ err: e }, "[upload] failed");
    return NextResponse.json(
      { error: "Gagal mengunggah file. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
