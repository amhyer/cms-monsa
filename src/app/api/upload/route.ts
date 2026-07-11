import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"];

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File tidak ditemukan pada request." },
        { status: 400 }
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 8MB." },
        { status: 400 }
      );
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeExt = ALLOWED.includes(file.type) ? ext : "bin";
    const filename = `${randomUUID()}.${safeExt}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json(
      { error: "Gagal mengunggah file." },
      { status: 500 }
    );
  }
}
