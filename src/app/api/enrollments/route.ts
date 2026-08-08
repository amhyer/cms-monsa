import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { rateLimitPublicForm } from "@/lib/rate-limit";
import { createEnrollmentSchema, validateBody } from "@/lib/validations";

// Note: createEnrollmentSchema and validateBody are used for Zod validation
// This ensures proper input validation for all enrollment fields

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;

  const [total, items] = await Promise.all([
    db.enrollment.count({ where }),
    db.enrollment.findMany({
      where,
      orderBy: { createdAt: "desc" },
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

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await rateLimitPublicForm(req);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const validation = validateBody(createEnrollmentSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;

    // Check for duplicate NISN
    const existing = await db.enrollment.findFirst({
      where: { nisn: data.nisn },
    });
    if (existing) {
      return NextResponse.json(
        { error: "NISN sudah terdaftar." },
        { status: 409 }
      );
    }

    const item = await db.enrollment.create({
      data: {
        nisn: data.nisn,
        fullName: data.fullName,
        gender: data.gender,
        dateOfBirth: new Date(data.dateOfBirth),
        placeOfBirth: data.placeOfBirth,
        address: data.address,
        phone: data.phone || null,
        email: data.email || null,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        parentEmail: data.parentEmail || null,
        parentOccupation: data.parentOccupation || null,
        previousSchool: data.previousSchool,
        previousSchoolAddress: data.previousSchoolAddress || null,
        programChoice: data.programChoice,
        birthCertUrl: data.birthCertUrl || null,
        diplomaUrl: data.diplomaUrl || null,
        photoUrl: data.photoUrl || null,
      },
    });

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      // Escape user input to prevent HTML injection in email
      const escapeHtml = (str: string) => str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      
      await sendEmail({
        to: adminEmail,
        subject: `[CMS] Pendaftaran SPMB Baru: ${escapeHtml(data.fullName)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Pendaftaran SPMB Baru</h2>
            <p><strong>Nama:</strong> ${escapeHtml(data.fullName)}</p>
            <p><strong>NISN:</strong> ${escapeHtml(data.nisn)}</p>
            <p><strong>Jalur SPMB:</strong> ${escapeHtml(data.programChoice)}</p>
            <p><strong>Asal Sekolah:</strong> ${escapeHtml(data.previousSchool)}</p>
            <hr style="border: 1px solid #e5e7eb;" />
            <p style="color: #6b7280; font-size: 12px;">
              Email ini dikirim otomatis dari CMS UPT SPF SD Negeri Unggulan Mongisidi 1
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ ok: true, id: item.id });
  } catch (e) {
    console.error("[enrollment-create]", e);
    return NextResponse.json({ error: "Gagal mendaftarkan siswa." }, { status: 500 });
  }
}
