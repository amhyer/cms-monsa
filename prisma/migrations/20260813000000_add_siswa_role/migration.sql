-- AlterTable: tautan akun siswa (role SISWA) ke master Student
ALTER TABLE "User" ADD COLUMN "studentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- AddForeignKey: role SISWA → Student
ALTER TABLE "User" ADD CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: role ORANG_TUA → Student (sebelumnya kolom tanpa FK)
ALTER TABLE "User" ADD CONSTRAINT "User_guardianStudentId_fkey" FOREIGN KEY ("guardianStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
