-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN "studentId" TEXT;

-- CreateIndex
CREATE INDEX "Achievement_studentId_idx" ON "Achievement"("studentId");

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
