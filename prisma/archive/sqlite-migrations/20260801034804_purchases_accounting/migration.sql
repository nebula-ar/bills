-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "declaredTotal" INTEGER;
ALTER TABLE "Purchase" ADD COLUMN "expenseCategory" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "taxAmount" INTEGER;

-- AlterTable
ALTER TABLE "StockLevel" ADD COLUMN "avgCost" INTEGER;

-- CreateTable
CREATE TABLE "PurchaseCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "number" TEXT,
    "reason" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    CONSTRAINT "PurchaseCredit_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PurchaseCredit_purchaseId_idx" ON "PurchaseCredit"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseCredit_issuedAt_idx" ON "PurchaseCredit"("issuedAt");

-- CreateIndex
CREATE INDEX "PurchaseCredit_deletedAt_idx" ON "PurchaseCredit"("deletedAt");
