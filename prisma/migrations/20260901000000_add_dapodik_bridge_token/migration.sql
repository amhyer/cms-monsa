-- AlterTable
-- Kolom kunci pairing jembatan Dapodik. IF NOT EXISTS agar migrasi idempotent:
-- runtime sudah self-heal (ensureBridgeColumns) menambah kolom yang belum ada,
-- jadi jika kolom sudah dibuat lebih dulu, migrasi ini tidak boleh gagal.
ALTER TABLE "DapodikConfig" ADD COLUMN IF NOT EXISTS "bridgeTokenHash" TEXT;
ALTER TABLE "DapodikConfig" ADD COLUMN IF NOT EXISTS "bridgeTokenPrefix" TEXT;
ALTER TABLE "DapodikConfig" ADD COLUMN IF NOT EXISTS "bridgeTokenCreatedAt" TIMESTAMP(3);
