-- CreateTable
CREATE TABLE "OrgStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "photo" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgStructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgStructure_order_idx" ON "OrgStructure"("order");
