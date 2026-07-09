-- CreateTable
CREATE TABLE "AccountOpeningBalance" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountOpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "fromMethod" "PaymentMethod" NOT NULL,
    "toMethod" "PaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClose" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCloseLine" (
    "id" TEXT NOT NULL,
    "closeId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "systemAmount" INTEGER NOT NULL,
    "countedAmount" INTEGER NOT NULL,

    CONSTRAINT "CashCloseLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountOpeningBalance_businessId_idx" ON "AccountOpeningBalance"("businessId");

-- CreateIndex
CREATE INDEX "AccountOpeningBalance_branchId_idx" ON "AccountOpeningBalance"("branchId");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_movedAt_idx" ON "AccountTransfer"("businessId", "movedAt");

-- CreateIndex
CREATE INDEX "AccountTransfer_branchId_idx" ON "AccountTransfer"("branchId");

-- CreateIndex
CREATE INDEX "AccountTransfer_deletedAt_idx" ON "AccountTransfer"("deletedAt");

-- CreateIndex
CREATE INDEX "CashClose_businessId_closedAt_idx" ON "CashClose"("businessId", "closedAt");

-- CreateIndex
CREATE INDEX "CashClose_branchId_idx" ON "CashClose"("branchId");

-- CreateIndex
CREATE INDEX "CashCloseLine_closeId_idx" ON "CashCloseLine"("closeId");

-- AddForeignKey
ALTER TABLE "AccountOpeningBalance" ADD CONSTRAINT "AccountOpeningBalance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountOpeningBalance" ADD CONSTRAINT "AccountOpeningBalance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClose" ADD CONSTRAINT "CashClose_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClose" ADD CONSTRAINT "CashClose_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCloseLine" ADD CONSTRAINT "CashCloseLine_closeId_fkey" FOREIGN KEY ("closeId") REFERENCES "CashClose"("id") ON DELETE CASCADE ON UPDATE CASCADE;

