import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];
const MAX_SIZE = 8 * 1024 * 1024;
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "File kosong." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Ukuran file maksimal 8MB." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Tipe file tidak diizinkan." }, { status: 400 });
    const extByMime: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4" };
    const ext = extByMime[file.type] || "bin";
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json({ error: "Gagal mengunggah file." }, { status: 500 });
  }
}
