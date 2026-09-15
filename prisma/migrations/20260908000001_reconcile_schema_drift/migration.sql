/*
  Rekonsiliasi drift antara riwayat migrasi dan prisma/schema.prisma.

  Latar belakang: skema berevolusi lewat `prisma db push` (script db:migrate)
  sementara direktori migrations tertinggal - akibatnya `prisma migrate deploy`
  di database baru menghasilkan skema yang TIDAK cocok dengan schema.prisma
  (User tanpa mustChangePassword/2FA, tabel TeacherSection/StudentAchievement/dll.
  tidak ada) - ditemukan oleh validasi live terhadap Postgres nyata (2026-09-08).
  Migrasi ini menjembatani seluruh selisih; SQL dihasilkan oleh
  `prisma migrate diff --from-migrations --to-schema-datamodel` dan hanya
  bersifat aditif (ADD COLUMN / CREATE TABLE / CREATE INDEX), dibuat idempoten
  (IF NOT EXISTS + guard DO block) agar aman di DB yang sudah db-push.
*/
-- DropForeignKey
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_userId_fkey') THEN
    ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_userId_fkey";
  END IF;
END $$;

-- AlterTable
ALTER TABLE "DapodikConfig" ADD COLUMN IF NOT EXISTS     "cfAccessClientId" TEXT,
ADD COLUMN IF NOT EXISTS     "cfAccessClientSecret" TEXT;

-- AlterTable
ALTER TABLE "OrgStructure" ADD COLUMN IF NOT EXISTS     "bio" TEXT,
ADD COLUMN IF NOT EXISTS     "contact" TEXT;

-- AlterTable
ALTER TABLE "StorageAlertState" ALTER COLUMN "id" SET DEFAULT 'singleton';

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS     "consultationNote" TEXT,
ADD COLUMN IF NOT EXISTS     "cvUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "githubUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "languages" TEXT,
ADD COLUMN IF NOT EXISTS     "linkedinUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "officeHours" TEXT,
ADD COLUMN IF NOT EXISTS     "socialLinks" TEXT,
ADD COLUMN IF NOT EXISTS     "websiteUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "teacherId" TEXT,
ADD COLUMN IF NOT EXISTS     "twoFactorBackupCodes" TEXT,
ADD COLUMN IF NOT EXISTS     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeacherSection" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeacherRating" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudentAchievement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Akademik',
    "level" TEXT NOT NULL DEFAULT 'Sekolah',
    "date" TIMESTAMP(3) NOT NULL,
    "certificate" TEXT,
    "issuedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Akademik',
    "type" TEXT NOT NULL DEFAULT 'EVENT',
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "imageUrl" TEXT,
    "maxParticipants" INTEGER,
    "requiresRegistration" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventReminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Album" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Kegiatan',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Photo" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Administrasi',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "version" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'PUBLIC',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Info',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "imageUrl" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StarOfMonth" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "reason" TEXT NOT NULL,
    "achievement" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StarOfMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ParentTestimonial" (
    "id" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "studentName" TEXT,
    "className" TEXT,
    "relation" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "photoUrl" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentTestimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolTimeline" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Pencapaian',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NewsTicker" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Info',
    "link" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsTicker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timeSlot" INTEGER NOT NULL,
    "timeLabel" TEXT,
    "subject" TEXT NOT NULL,
    "teacherId" TEXT,
    "roomId" TEXT,
    "classId" TEXT,
    "academicYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeacherSection_teacherId_order_idx" ON "TeacherSection"("teacherId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeacherRating_teacherId_createdAt_idx" ON "TeacherRating"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeacherRating_isApproved_idx" ON "TeacherRating"("isApproved");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentAchievement_studentId_date_idx" ON "StudentAchievement"("studentId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentAchievement_category_idx" ON "StudentAchievement"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentAchievement_level_idx" ON "StudentAchievement"("level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolEvent_startDate_idx" ON "SchoolEvent"("startDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolEvent_category_idx" ON "SchoolEvent"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventRegistration_eventId_status_idx" ON "EventRegistration"("eventId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventReminder_remindAt_status_idx" ON "EventReminder"("remindAt", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Album_category_sortOrder_idx" ON "Album"("category", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Photo_albumId_sortOrder_idx" ON "Photo"("albumId", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Photo_isFeatured_idx" ON "Photo"("isFeatured");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolDocument_category_idx" ON "SchoolDocument"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolDocument_accessLevel_idx" ON "SchoolDocument"("accessLevel");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolAnnouncement_category_priority_idx" ON "SchoolAnnouncement"("category", "priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolAnnouncement_isPinned_publishedAt_idx" ON "SchoolAnnouncement"("isPinned", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolAnnouncement_targetAudience_idx" ON "SchoolAnnouncement"("targetAudience");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnnouncementRead_userId_readAt_idx" ON "AnnouncementRead"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSubscriber_token_key" ON "NewsletterSubscriber"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_email_idx" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_isActive_idx" ON "NewsletterSubscriber"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StarOfMonth_type_month_year_idx" ON "StarOfMonth"("type", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StarOfMonth_type_month_year_key" ON "StarOfMonth"("type", "month", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentTestimonial_isPublished_createdAt_idx" ON "ParentTestimonial"("isPublished", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentTestimonial_rating_idx" ON "ParentTestimonial"("rating");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolTimeline_year_sortOrder_idx" ON "SchoolTimeline"("year", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolTimeline_category_idx" ON "SchoolTimeline"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsTicker_isActive_priority_idx" ON "NewsTicker"("isActive", "priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NewsTicker_startsAt_expiresAt_idx" ON "NewsTicker"("startsAt", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScheduleEntry_day_timeSlot_idx" ON "ScheduleEntry"("day", "timeSlot");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScheduleEntry_classId_academicYear_idx" ON "ScheduleEntry"("classId", "academicYear");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScheduleEntry_teacherId_idx" ON "ScheduleEntry"("teacherId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Agenda_date_idx" ON "Agenda"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Agenda_category_idx" ON "Agenda"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Announcement_isActive_idx" ON "Announcement"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Complaint_role_idx" ON "Complaint"("role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Complaint_category_idx" ON "Complaint"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GalleryItem_category_idx" ON "GalleryItem"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Teacher_isActive_idx" ON "Teacher"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_teacherId_key" ON "User"("teacherId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_teacherId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherSection_teacherId_fkey') THEN
    ALTER TABLE "TeacherSection" ADD CONSTRAINT "TeacherSection_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherRating_teacherId_fkey') THEN
    ALTER TABLE "TeacherRating" ADD CONSTRAINT "TeacherRating_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherRating_userId_fkey') THEN
    ALTER TABLE "TeacherRating" ADD CONSTRAINT "TeacherRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_userId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAchievement_studentId_fkey') THEN
    ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolEvent_createdById_fkey') THEN
    ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventRegistration_eventId_fkey') THEN
    ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SchoolEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventRegistration_userId_fkey') THEN
    ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventReminder_eventId_fkey') THEN
    ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SchoolEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventReminder_userId_fkey') THEN
    ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Album_createdById_fkey') THEN
    ALTER TABLE "Album" ADD CONSTRAINT "Album_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Photo_albumId_fkey') THEN
    ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Photo_uploadedById_fkey') THEN
    ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolDocument_uploadedById_fkey') THEN
    ALTER TABLE "SchoolDocument" ADD CONSTRAINT "SchoolDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolAnnouncement_createdById_fkey') THEN
    ALTER TABLE "SchoolAnnouncement" ADD CONSTRAINT "SchoolAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnnouncementRead_announcementId_fkey') THEN
    ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "SchoolAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnnouncementRead_userId_fkey') THEN
    ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StarOfMonth_studentId_fkey') THEN
    ALTER TABLE "StarOfMonth" ADD CONSTRAINT "StarOfMonth_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StarOfMonth_teacherId_fkey') THEN
    ALTER TABLE "StarOfMonth" ADD CONSTRAINT "StarOfMonth_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleEntry_teacherId_fkey') THEN
    ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleEntry_classId_fkey') THEN
    ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

