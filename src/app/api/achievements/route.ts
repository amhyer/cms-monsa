import { safeJson, withErrorHandling } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { logActivity } from "@/lib/log";
import { parseDateInput } from "@/lib/format";
import { withCache } from "@/lib/cache";
import { rateLimitPublicGet } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Rate limit public GET (anti-scraping NIS/NISN di kartu prestasi).
  const rl = await rateLimitPublicGet(req, 60, 60000);
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));

  const [total, rows] = await Promise.all([
    db.achievement.count(),
    db.achievement.findMany({
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { student: { select: { nis: true, nisn: true } } },
    }),
  ]);
  // NIS/NISN siswa tertaut ikut publik — ditampilkan di kartu prestasi
  // (halaman publik maupun dashboard) untuk pengecekan silang Dapodik.
  const items = rows.map(({ student, ...rest }) => ({
    ...rest,
    studentNis: student?.nis ?? null,
    studentNisn: student?.nisn ?? null,
  }));
  return withCache(
    NextResponse.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }),
    "public, s-maxage=300, stale-while-revalidate=600"
  );
}

async function POST_impl(req: NextRequest) {

  const csrfError = await requireCsrf(req);
  if (csrfError) return csrfError;

  const auth = await requireRole("OPERATOR");
  if (!auth.ok) return auth.response;
  const parsed = await safeJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Judul prestasi wajib diisi." }, { status: 400 });
  }
  let studentId: string | null = null;
  if (body.studentId) {
    const student = await db.student.findUnique({ where: { id: String(body.studentId) } });
    if (!student) {
      return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 400 });
    }
    studentId = student.id;
  }
  const item = await db.achievement.create({
    data: {
      title,
      description: body.description || null,
      studentName: body.studentName || null,
      studentId,
      level: String(body.level || "Kabupaten"),
      category: String(body.category || "Akademik"),
      date: body.date ? parseDateInput(String(body.date)) : new Date(),
    },
  });
  await logActivity(auth.user, "CREATE", "Achievement", `Menambah prestasi: ${title}`, item.id);
  return NextResponse.json(item);
}

// Proteksi error konsisten (gate: check-mutation-handlers) — klien menerima
// 500 tersanitasi, server mencatat trace via logger.error.
export const POST = withErrorHandling(POST_impl);
