/*
  Status alert storage upload (model StorageAlertState di prisma/schema.prisma).
  Menyimpan flag "pemakaian sudah di atas ambang" agar cron /api/cron/storage-alert
  tidak mengirim notifikasi berulang setiap hari selama pemakaian masih di atas
  ambang — hanya sekali per "persilangan" (crossing).
*/
-- CreateTable
CREATE TABLE "StorageAlertState" (
    "id" TEXT NOT NULL,
    "aboveThreshold" BOOLEAN NOT NULL DEFAULT false,
    "lastAlertedAt" TIMESTAMP(3),
    "lastUsagePercent" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageAlertState_pkey" PRIMARY KEY ("id")
);