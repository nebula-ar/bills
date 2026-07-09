-- CreateTable
CREATE TABLE "AccountOpeningBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountOpeningBalance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountOpeningBalance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AccountOpeningBalance_businessId_idx" ON "AccountOpeningBalance"("businessId");

-- CreateIndex
CREATE INDEX "AccountOpeningBalance_branchId_idx" ON "AccountOpeningBalance"("branchId");

-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "fromMethod" TEXT NOT NULL,
    "toMethod" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "movedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    CONSTRAINT "AccountTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_movedAt_idx" ON "AccountTransfer"("businessId", "movedAt");

-- CreateIndex
CREATE INDEX "AccountTransfer_branchId_idx" ON "AccountTransfer"("branchId");

-- CreateIndex
CREATE INDEX "AccountTransfer_deletedAt_idx" ON "AccountTransfer"("deletedAt");

-- CreateTable
CREATE TABLE "CashClose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashClose_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashClose_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CashClose_businessId_closedAt_idx" ON "CashClose"("businessId", "closedAt");

-- CreateIndex
CREATE INDEX "CashClose_branchId_idx" ON "CashClose"("branchId");

-- CreateTable
CREATE TABLE "CashCloseLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "closeId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "systemAmount" INTEGER NOT NULL,
    "countedAmount" INTEGER NOT NULL,
    CONSTRAINT "CashCloseLine_closeId_fkey" FOREIGN KEY ("closeId") REFERENCES "CashClose" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CashCloseLine_closeId_idx" ON "CashCloseLine"("closeId");
