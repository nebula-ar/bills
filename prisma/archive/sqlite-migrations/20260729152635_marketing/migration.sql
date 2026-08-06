-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "birthday" DATETIME;

-- CreateTable
CREATE TABLE "LoyaltyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "saleId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "LoyaltyEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoyaltyEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoyaltyEntry_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "cuit" TEXT,
    "taxCondition" TEXT,
    "salesPointNumber" INTEGER,
    "afipCertEncrypted" TEXT,
    "afipKeyEncrypted" TEXT,
    "afipCertAlias" TEXT,
    "afipCertCreatedAt" DATETIME,
    "publicToken" TEXT,
    "publicPageActive" BOOLEAN NOT NULL DEFAULT false,
    "publicNote" TEXT,
    "googleReviewUrl" TEXT,
    "pointsPerAmount" INTEGER,
    "pointValue" INTEGER
);
INSERT INTO "new_Business" ("afipCertAlias", "afipCertCreatedAt", "afipCertEncrypted", "afipKeyEncrypted", "createdAt", "createdById", "cuit", "deleted", "deletedAt", "deletedById", "id", "name", "salesPointNumber", "taxCondition", "updatedAt", "updatedById", "vertical") SELECT "afipCertAlias", "afipCertCreatedAt", "afipCertEncrypted", "afipKeyEncrypted", "createdAt", "createdById", "cuit", "deleted", "deletedAt", "deletedById", "id", "name", "salesPointNumber", "taxCondition", "updatedAt", "updatedById", "vertical" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE UNIQUE INDEX "Business_publicToken_key" ON "Business"("publicToken");
CREATE INDEX "Business_deletedAt_idx" ON "Business"("deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "LoyaltyEntry_businessId_idx" ON "LoyaltyEntry"("businessId");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_customerId_idx" ON "LoyaltyEntry"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_saleId_idx" ON "LoyaltyEntry"("saleId");
