import { safeJson, withErrorHandling } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { rateLimitPublicForm } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * POST /api/newsletter
 * Public: subscribe to newsletter
 */
export async function POST(req: NextRequest) {
  const rateLimited = await rateLimitPublicForm(req);
  if (rateLimited) return rateLimited;

  try {
    const parsed = await safeJson(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { email, name } = body;

    // Validate email
    if (!email?.trim()) {
      return NextResponse.json(
        { error: "Email wajib diisi." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    // Check if already subscribed
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json(
          { message: "Anda sudah berlangganan newsletter kami." },
          { status: 200 }
        );
      }
      // Reactivate subscription
      await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return NextResponse.json(
        { message: "Berlangganan newsletter berhasil diaktifkan kembali!" },
        { status: 200 }
      );
    }

    // Create new subscription
    const token = randomBytes(32).toString("hex");
    await db.newsletterSubscriber.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        token,
      },
    });

    return NextResponse.json(
      { message: "Berlangganan newsletter berhasil! Terima kasih." },
      { status: 201 }
    );
  } catch (e) {
    logger.error({ err: e }, "[newsletter] POST error");
    return NextResponse.json(
      { error: "Gagal berlangganan newsletter." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/newsletter
 * Public: unsubscribe from newsletter
 */
async function DELETE_impl(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Token tidak valid." },
      { status: 400 }
    );
  }

  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { token },
  });

  if (!subscriber) {
    return NextResponse.json(
      { error: "Subscription tidak ditemukan." },
      { status: 404 }
    );
  }

  await db.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { isActive: false },
  });

  return NextResponse.json(
    { message: "Berhasil berhenti berlangganan." },
    { status: 200 }
  );
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const DELETE = withErrorHandling(DELETE_impl, { errorMessage: "Gagal berhenti berlangganan." });
