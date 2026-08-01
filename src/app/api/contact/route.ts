import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createContactSchema, validateBody } from "@/lib/validations";
import { sendEmail, emailTemplates } from "@/lib/email";
import { rateLimitPublicForm } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rateLimited = rateLimitPublicForm(req);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const validation = validateBody(createContactSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { name, email, subject, message } = validation.data;
    const item = await db.contactMessage.create({
      data: {
        name,
        email,
        phone: body.phone ? String(body.phone) : null,
        subject,
        message,
      },
    });

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const template = emailTemplates.contactNotification(name, subject, message);
      await sendEmail({
        to: adminEmail,
        subject: template.subject,
        html: template.html,
      });
    }

    return NextResponse.json({ ok: true, id: item.id });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json({ error: "Gagal mengirim pesan." }, { status: 500 });
  }
}
