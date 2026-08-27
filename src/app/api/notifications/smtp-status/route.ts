import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

/**
 * GET status konfigurasi SMTP — hanya mengembalikan metadata ringkas
 * (host, port, user, configured) tanpa membocorkan password/secret.
 * Dipakai oleh dashboard untuk menampilkan indikator kesehatan.
 */
export async function GET() {
  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || "";
  const configured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

  return NextResponse.json({
    configured,
    host,
    port,
    // Tampilkan username parsial — misal "admin@school" dari "admin@school.id"
    // untuk verifikasi tanpa membocorkan alamat lengkap.
    userPreview: user ? `${user.split("@")[0]}@…` : null,
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Gunakan GET untuk melihat status SMTP." },
    { status: 405 }
  );
}
