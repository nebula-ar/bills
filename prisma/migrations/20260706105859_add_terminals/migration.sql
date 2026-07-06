-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    CONSTRAINT "Terminal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "terminalId" TEXT,
    "total" INTEGER NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("barberId", "branchId", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "id", "notes", "soldAt", "status", "total", "updatedAt", "updatedById") SELECT "barberId", "branchId", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "id", "notes", "soldAt", "status", "total", "updatedAt", "updatedById" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_branchId_soldAt_idx" ON "Sale"("branchId", "soldAt");
CREATE INDEX "Sale_barberId_soldAt_idx" ON "Sale"("barberId", "soldAt");
CREATE INDEX "Sale_terminalId_idx" ON "Sale"("terminalId");
CREATE INDEX "Sale_deletedAt_idx" ON "Sale"("deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Terminal_branchId_idx" ON "Terminal"("branchId");

-- CreateIndex
CREATE INDEX "Terminal_deletedAt_idx" ON "Terminal"("deletedAt");
