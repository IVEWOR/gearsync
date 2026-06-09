-- CreateTable
CREATE TABLE "CategoryMapping" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "shopifyProductType" TEXT NOT NULL,
    "externalCategoryId" TEXT NOT NULL,
    "externalCategoryName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryMapping_shopId_marketplace_idx" ON "CategoryMapping"("shopId", "marketplace");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMapping_shopId_marketplace_shopifyProductType_key" ON "CategoryMapping"("shopId", "marketplace", "shopifyProductType");

-- AddForeignKey
ALTER TABLE "CategoryMapping" ADD CONSTRAINT "CategoryMapping_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
