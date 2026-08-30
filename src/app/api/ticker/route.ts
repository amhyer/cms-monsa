import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * GET /api/ticker
 * Public: get active news ticker items
 */
export async function GET() {
  try {
    const now = new Date();

    const tickers = await db.newsTicker.findMany({
      where: {
        isActive: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { priority: "asc" },
      take: 10,
      select: {
        id: true,
        content: true,
        category: true,
        link: true,
        priority: true,
      },
    });

    return NextResponse.json({ tickers });
  } catch (e) {
    logger.error({ err: e }, "[ticker] GET error");
    return NextResponse.json(
      { error: "Gagal memuat ticker." },
      { status: 500 }
    );
  }
}
