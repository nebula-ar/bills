-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "validUntil" DATETIME NOT NULL,
    "publicToken" TEXT NOT NULL,
    "saleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    CONSTRAINT "Quote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1000,
    "unit" TEXT NOT NULL DEFAULT 'UNIT',
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_saleId_key" ON "Quote"("saleId");

-- CreateIndex
CREATE INDEX "Quote_businessId_status_idx" ON "Quote"("businessId", "status");

-- CreateIndex
CREATE INDEX "Quote_branchId_idx" ON "Quote"("branchId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_deletedAt_idx" ON "Quote"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_businessId_number_key" ON "Quote"("businessId", "number");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");
