import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireRole("SUPER_ADMIN");
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "50")));
  const entity = searchParams.get("entity");
  const where = entity ? { entity } : {};
  const items = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ items });
}
