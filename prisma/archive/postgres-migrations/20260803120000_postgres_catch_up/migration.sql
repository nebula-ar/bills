-- Postgres se quedó atrás de SQLite.
--
-- Dos migraciones de `prisma/migrations` del 2026-08-01 nunca se replicaron
-- acá: `20260801023050_expense_supplier` y `20260801034804_purchases_accounting`.
-- El código las usa igual —`report.repository.ts` selecciona `StockLevel.avgCost`
-- para valuar el stock— así que en producción el dashboard rompe con
-- "column does not exist" y se cae el `Promise.all` entero de la pantalla.
--
-- Todo va con IF NOT EXISTS a propósito. Una migración de Prisma normalmente no
-- es idempotente, pero acá no sabemos con certeza si alguien ya parchó la base a
-- mano: es preferible que corra dos veces sin romper a que falle el deploy.

-- AlterEnum
-- Salida de stock por compra anulada. En Postgres 12+ se puede agregar un valor
-- de enum dentro de la transacción de la migración siempre que no se USE en la
-- misma transacción; acá solo se declara.
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'PURCHASE_CANCELLED';

-- AlterTable: costo promedio ponderado de lo que hay en cada sucursal.
ALTER TABLE "StockLevel" ADD COLUMN IF NOT EXISTS "avgCost" INTEGER;

-- AlterTable: lo que dice el papel, el IVA discriminado y qué se compró.
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "declaredTotal" INTEGER;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "taxAmount" INTEGER;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "expenseCategory" "ExpenseCategory";

-- AlterTable: un gasto suelto puede nombrar al proveedor sin arrastrar factura.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

-- CreateTable: nota de crédito del proveedor (baja la deuda sin mover plata).
CREATE TABLE IF NOT EXISTS "PurchaseCredit" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "number" TEXT,
    "reason" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PurchaseCredit_purchaseId_idx" ON "PurchaseCredit"("purchaseId");
CREATE INDEX IF NOT EXISTS "PurchaseCredit_issuedAt_idx" ON "PurchaseCredit"("issuedAt");
CREATE INDEX IF NOT EXISTS "PurchaseCredit_deletedAt_idx" ON "PurchaseCredit"("deletedAt");
CREATE INDEX IF NOT EXISTS "Expense_supplierId_idx" ON "Expense"("supplierId");

-- AddForeignKey
-- Postgres no tiene `ADD CONSTRAINT IF NOT EXISTS`, así que se pregunta antes.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseCredit_purchaseId_fkey') THEN
        ALTER TABLE "PurchaseCredit" ADD CONSTRAINT "PurchaseCredit_purchaseId_fkey"
            FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_supplierId_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey"
            FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
