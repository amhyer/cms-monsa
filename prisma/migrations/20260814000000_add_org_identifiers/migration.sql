-- AlterTable: identifier Dapodik (NUPTK/NIP/NIK) pada struktur organisasi
ALTER TABLE "OrgStructure" ADD COLUMN "nuptk" TEXT;
ALTER TABLE "OrgStructure" ADD COLUMN "nip" TEXT;
ALTER TABLE "OrgStructure" ADD COLUMN "nik" TEXT;
