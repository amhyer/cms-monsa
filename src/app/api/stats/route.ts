import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

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
    recentLogs,
    recentMessages,
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
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

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
      visits,
    },
    recentLogs,
    recentMessages,
  });
}
