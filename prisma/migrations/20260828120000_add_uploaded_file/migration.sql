/*
  Tabel UploadedFile — penyimpanan upload di database untuk platform dengan
  filesystem ephemeral (Vercel). Lihat model UploadedFile di schema.postgres.prisma
  dan src/lib/file-storage.ts (pemilihan backend disk vs db).
*/
-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_filename_key" ON "UploadedFile"("filename");
CREATE INDEX "UploadedFile_createdAt_idx" ON "UploadedFile"("createdAt");
