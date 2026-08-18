-- CreateTable
CREATE TABLE "BosDocument" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BosDocument_year_idx" ON "BosDocument"("year");

-- AddForeignKey
ALTER TABLE "BosDocument" ADD CONSTRAINT "BosDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
