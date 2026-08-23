import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

/**
 * POST /api/newsletter
 * Public: subscribe to newsletter
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    console.error("[newsletter] POST error:", e);
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
export async function DELETE(req: NextRequest) {
  try {
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
  } catch (e) {
    console.error("[newsletter] DELETE error:", e);
    return NextResponse.json(
      { error: "Gagal berhenti berlangganan." },
      { status: 500 }
    );
  }
}
