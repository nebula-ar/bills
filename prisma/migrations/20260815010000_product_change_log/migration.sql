-- Auditoría de cambios de producto. Append-only, igual que StockMovement.
--
-- `previous`/`next` van como texto con el valor CRUDO (el entero de la plata,
-- no "$ 9.520"): formatear al guardar congelaría el formato de hoy.
--
-- Todo aditivo: tabla y enum nuevos, ninguna columna existente se toca.
CREATE TYPE "ProductChangeField" AS ENUM (
  'NAME', 'PRICE', 'COST', 'DESCRIPTION', 'AVAILABILITY',
  'MIN_STOCK', 'IDEAL_STOCK', 'SKU', 'BARCODE', 'CATEGORY'
);

CREATE TABLE "ProductChange" (
  "id"          TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "businessId"  TEXT NOT NULL,
  "branchId"    TEXT,
  "field"       "ProductChangeField" NOT NULL,
  "previous"    TEXT,
  "next"        TEXT,
  "changedById" TEXT,
  "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductChange_productId_changedAt_idx" ON "ProductChange"("productId", "changedAt");
CREATE INDEX "ProductChange_businessId_changedAt_idx" ON "ProductChange"("businessId", "changedAt");

ALTER TABLE "ProductChange"
  ADD CONSTRAINT "ProductChange_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
