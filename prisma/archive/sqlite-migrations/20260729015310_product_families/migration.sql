-- CreateTable
CREATE TABLE "ProductFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    CONSTRAINT "ProductFamily_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "familyId" TEXT,
    "variantLabel" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'SERVICE',
    "unit" TEXT NOT NULL DEFAULT 'UNIT',
    "sku" TEXT,
    "barcode" TEXT,
    "cost" INTEGER,
    "imageUpdatedAt" DATETIME,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "minStock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("active", "barcode", "businessId", "categoryId", "cost", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "description", "id", "imageUpdatedAt", "kind", "minStock", "name", "sku", "trackStock", "unit", "updatedAt", "updatedById") SELECT "active", "barcode", "businessId", "categoryId", "cost", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "description", "id", "imageUpdatedAt", "kind", "minStock", "name", "sku", "trackStock", "unit", "updatedAt", "updatedById" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");
CREATE INDEX "Product_familyId_idx" ON "Product"("familyId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
CREATE UNIQUE INDEX "Product_businessId_sku_key" ON "Product"("businessId", "sku");
CREATE UNIQUE INDEX "Product_businessId_barcode_key" ON "Product"("businessId", "barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProductFamily_businessId_idx" ON "ProductFamily"("businessId");

-- CreateIndex
CREATE INDEX "ProductFamily_deletedAt_idx" ON "ProductFamily"("deletedAt");
