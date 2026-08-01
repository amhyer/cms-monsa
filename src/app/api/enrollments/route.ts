import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { rateLimitPublicForm } from "@/lib/rate-limit";

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
    const rateLimited = rateLimitPublicForm(req);
    if (rateLimited) return rateLimited;

    const body = await req.json();

    // Validate required fields
    const requiredFields = [
      "nisn", "fullName", "gender", "dateOfBirth", "placeOfBirth",
      "address", "parentName", "parentPhone", "previousSchool", "programChoice"
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Field ${field} wajib diisi.` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate NISN
    const existing = await db.enrollment.findFirst({
      where: { nisn: String(body.nisn).trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "NISN sudah terdaftar." },
        { status: 409 }
      );
    }

    const item = await db.enrollment.create({
      data: {
        nisn: String(body.nisn).trim(),
        fullName: String(body.fullName).trim(),
        gender: body.gender,
        dateOfBirth: new Date(body.dateOfBirth),
        placeOfBirth: String(body.placeOfBirth).trim(),
        address: String(body.address).trim(),
        phone: body.phone || null,
        email: body.email || null,
        parentName: String(body.parentName).trim(),
        parentPhone: String(body.parentPhone).trim(),
        parentEmail: body.parentEmail || null,
        parentOccupation: body.parentOccupation || null,
        previousSchool: String(body.previousSchool).trim(),
        previousSchoolAddress: body.previousSchoolAddress || null,
        programChoice: body.programChoice,
        birthCertUrl: body.birthCertUrl || null,
        diplomaUrl: body.diplomaUrl || null,
        photoUrl: body.photoUrl || null,
      },
    });

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `[CMS] Pendaftaran SPMB Baru: ${body.fullName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Pendaftaran SPMB Baru</h2>
            <p><strong>Nama:</strong> ${body.fullName}</p>
            <p><strong>NISN:</strong> ${body.nisn}</p>
            <p><strong>Jalur SPMB:</strong> ${body.programChoice}</p>
            <p><strong>Asal Sekolah:</strong> ${body.previousSchool}</p>
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
