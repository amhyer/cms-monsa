import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCsrf } from "@/lib/csrf";
import { requireRole } from "@/lib/auth";
import { createSchoolEventSchema, validateBody } from "@/lib/validations";

/**
 * GET /api/events
 * Public: get school events
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const category = searchParams.get("category");
    const upcoming = searchParams.get("upcoming") === "true";
    const month = searchParams.get("month"); // format: YYYY-MM

    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    if (upcoming) {
      where.startDate = { gte: new Date() };
    }

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59);
      where.startDate = { gte: start, lte: end };
    }

    const events = await db.schoolEvent.findMany({
      where,
      orderBy: { startDate: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        location: true,
        category: true,
        type: true,
        isAllDay: true,
        color: true,
        imageUrl: true,
        maxParticipants: true,
        requiresRegistration: true,
        _count: {
          select: { registrations: true },
        },
      },
    });

    // Get categories with counts
    const categories = await db.schoolEvent.groupBy({
      by: ["category"],
      where: { isPublished: true },
      _count: { id: true },
    });

    return NextResponse.json({
      events: events.map((e) => ({
        ...e,
        registrationCount: e._count.registrations,
        _count: undefined,
      })),
      categories: categories.map((c) => ({
        name: c.category,
        count: c._count.id,
      })),
    });
  } catch (e) {
    console.error("[events] GET error:", e);
    return NextResponse.json(
      { error: "Gagal memuat event." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 * Admin: create school event
 */
export async function POST(req: NextRequest) {
  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const validation = validateBody(createSchoolEventSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const {
      title,
      description,
      startDate,
      endDate,
      location,
      category,
      type,
      isAllDay,
      color,
      imageUrl,
      maxParticipants,
      requiresRegistration,
    } = validation.data;

    // Create event
    const event = await db.schoolEvent.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : new Date(startDate),
        location: location?.trim() || null,
        category: category || "Akademik",
        type: type || "EVENT",
        isAllDay: isAllDay || false,
        color: color?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        maxParticipants: maxParticipants || null,
        requiresRegistration: requiresRegistration || false,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    console.error("[events] POST error:", e);
    return NextResponse.json(
      { error: "Gagal membuat event." },
      { status: 500 }
    );
  }
}
