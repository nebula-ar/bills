-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reason" TEXT,
    "returnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleReturnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "returnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SaleReturn_saleId_idx" ON "SaleReturn"("saleId");

-- CreateIndex
CREATE INDEX "SaleReturn_branchId_returnedAt_idx" ON "SaleReturn"("branchId", "returnedAt");

-- CreateIndex
CREATE INDEX "SaleReturn_method_idx" ON "SaleReturn"("method");

-- CreateIndex
CREATE INDEX "SaleReturnItem_returnId_idx" ON "SaleReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "SaleReturnItem_saleItemId_idx" ON "SaleReturnItem"("saleItemId");
