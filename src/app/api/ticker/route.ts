import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { db } from "@/lib/db";

/**
 * GET /api/ticker
 * Public: get active news ticker items
 */
async function GET_impl() {
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
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const GET = withErrorHandling(GET_impl, { errorMessage: "Gagal memuat ticker." });
