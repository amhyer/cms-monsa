-- CreateTable
CREATE TABLE "BosExpenditure" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "quarter" INTEGER,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosExpenditure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BosExpenditure_year_idx" ON "BosExpenditure"("year");

-- CreateIndex
CREATE INDEX "BosExpenditure_source_idx" ON "BosExpenditure"("source");

-- AddForeignKey
ALTER TABLE "BosExpenditure" ADD CONSTRAINT "BosExpenditure_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
