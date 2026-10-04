-- CreateTable
CREATE TABLE "DapodikSyncLog" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "dataType" TEXT,
    "status" TEXT NOT NULL,
    "actor" TEXT,
    "sekolahCount" INTEGER NOT NULL DEFAULT 0,
    "gtkCount" INTEGER NOT NULL DEFAULT 0,
    "rombelCount" INTEGER NOT NULL DEFAULT 0,
    "siswaCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DapodikSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DapodikSyncAlertState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "alertOpen" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "detail" TEXT,
    "lastAlertedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DapodikSyncAlertState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DapodikSyncLog_createdAt_idx" ON "DapodikSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "DapodikSyncLog_status_createdAt_idx" ON "DapodikSyncLog"("status", "createdAt");
