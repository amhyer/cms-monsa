-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HADIR',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthPeriod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SiteSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "schoolName" TEXT NOT NULL DEFAULT 'UPT SPF SD Negeri Unggulan Mongisidi 1',
    "npsn" TEXT NOT NULL DEFAULT '40313912',
    "logo" TEXT,
    "address" TEXT NOT NULL DEFAULT 'Jln. Wr. Monginsidi No.13, Maricaya Baru, Makassar, Sulawesi Selatan',
    "phone" TEXT NOT NULL DEFAULT '04118918116',
    "email" TEXT NOT NULL DEFAULT 'sdn.unggulanmonginsidi@yahoo.co.id',
    "mapEmbed" TEXT,
    "vision" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "principalName" TEXT NOT NULL DEFAULT 'Nawawi Hamzah, S.Pd., M.Pd.',
    "principalPhoto" TEXT,
    "principalWelcome" TEXT NOT NULL,
    "facebook" TEXT,
    "instagram" TEXT,
    "youtube" TEXT,
    "tiktok" TEXT,
    "studentCount" INTEGER NOT NULL DEFAULT 402,
    "teacherCount" INTEGER NOT NULL DEFAULT 28,
    "facilityCount" INTEGER NOT NULL DEFAULT 18,
    "achievementCount" INTEGER NOT NULL DEFAULT 45,
    "spmbInfo" TEXT NOT NULL,
    "spmbLink" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SiteSetting" ("achievementCount", "address", "email", "facebook", "facilityCount", "history", "id", "instagram", "logo", "mapEmbed", "mission", "npsn", "phone", "principalName", "principalPhoto", "principalWelcome", "schoolName", "spmbInfo", "spmbLink", "studentCount", "teacherCount", "tiktok", "updatedAt", "vision", "youtube") SELECT "achievementCount", "address", "email", "facebook", "facilityCount", "history", "id", "instagram", "logo", "mapEmbed", "mission", "npsn", "phone", "principalName", "principalPhoto", "principalWelcome", "schoolName", "spmbInfo", "spmbLink", "studentCount", "teacherCount", "tiktok", "updatedAt", "vision", "youtube" FROM "SiteSetting";
DROP TABLE "SiteSetting";
ALTER TABLE "new_SiteSetting" RENAME TO "SiteSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Attendance_classId_date_idx" ON "Attendance"("classId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_key" ON "Attendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "Payment_studentId_monthPeriod_idx" ON "Payment"("studentId", "monthPeriod");

-- CreateIndex
CREATE INDEX "Payment_monthPeriod_idx" ON "Payment"("monthPeriod");
