-- AlterTable
ALTER TABLE "DapodikConfig" ADD COLUMN "bridgeTokenHash" TEXT;
ALTER TABLE "DapodikConfig" ADD COLUMN "bridgeTokenPrefix" TEXT;
ALTER TABLE "DapodikConfig" ADD COLUMN "bridgeTokenCreatedAt" TIMESTAMP(3);
