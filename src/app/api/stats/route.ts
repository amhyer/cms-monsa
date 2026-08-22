import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const isGuru = user.role === "GURU";
  const waliClassId = user.guardianClassId;

  const [
    totalNews,
    publishedNews,
    draftNews,
    activeAnnouncements,
    teacherCount,
    galleryCount,
    achievementCount,
    unreadMessages,
    userCount,
    studentCount,
    classCount,
    recentLogs,
    recentMessages,
    roleGroupRows,
  ] = await Promise.all([
    db.news.count(),
    db.news.count({ where: { status: "PUBLISHED" } }),
    db.news.count({ where: { status: "DRAFT" } }),
    db.announcement.count({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }),
    db.teacher.count({ where: { isActive: true } }),
    db.galleryItem.count(),
    db.achievement.count(),
    db.contactMessage.count({ where: { isRead: false } }),
    db.user.count(),
    db.student.count({
      where: {
        isActive: true,
        ...(isGuru && waliClassId ? { classId: waliClassId } : {}),
      },
    }),
    db.class.count({
      where: {
        isActive: true,
        ...(isGuru && waliClassId ? { id: waliClassId } : {}),
      },
    }),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      ...(isGuru ? { where: { userId: user.id } } : {}),
    }),
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    // Ringkasan per role akun — bentuknya SAMA dengan counts di GET
    // /api/users (Semua / Admin & Operator / Guru / Orang Tua / Siswa) agar
    // badge sidebar & ringkasan dashboard konsisten dengan tab users page.
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const roleCountMap = new Map(roleGroupRows.map((r) => [r.role, r._count._all]));
  const userRoleCounts = {
    all: Array.from(roleCountMap.values()).reduce((a, b) => a + b, 0),
    STAFF: (roleCountMap.get("SUPER_ADMIN") ?? 0) + (roleCountMap.get("OPERATOR") ?? 0),
    GURU: roleCountMap.get("GURU") ?? 0,
    ORANG_TUA: roleCountMap.get("ORANG_TUA") ?? 0,
    SISWA: roleCountMap.get("SISWA") ?? 0,
  };

  // Today's attendance summary
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const attendanceToday = await db.attendance.groupBy({
    by: ["status"],
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
      ...(isGuru && waliClassId ? { classId: waliClassId } : {}),
    },
    _count: true,
  });

  const attendance = {
    hadir: attendanceToday.find((a) => a.status === "HADIR")?._count ?? 0,
    sakit: attendanceToday.find((a) => a.status === "SAKIT")?._count ?? 0,
    izin: attendanceToday.find((a) => a.status === "IZIN")?._count ?? 0,
    alfa: attendanceToday.find((a) => a.status === "ALFA")?._count ?? 0,
    total: attendanceToday.reduce((acc, curr) => acc + curr._count, 0),
  };

  // crude "visits" mock — derive a pseudo number
  const visits = 18420 + Math.floor((Date.now() / 86400000) % 500);

  return NextResponse.json({
    counts: {
      totalNews,
      publishedNews,
      draftNews,
      activeAnnouncements,
      teacherCount,
      galleryCount,
      achievementCount,
      unreadMessages,
      userCount,
      studentCount,
      classCount,
      visits,
      userRoleCounts,
    },
    attendance,
    recentLogs,
    recentMessages,
  });
}
