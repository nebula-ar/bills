-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Terminal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "barberId" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    CONSTRAINT "Terminal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Terminal_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Terminal" ("active", "branchId", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "id", "name", "updatedAt", "updatedById") SELECT "active", "branchId", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "id", "name", "updatedAt", "updatedById" FROM "Terminal";
DROP TABLE "Terminal";
ALTER TABLE "new_Terminal" RENAME TO "Terminal";
CREATE INDEX "Terminal_branchId_idx" ON "Terminal"("branchId");
CREATE INDEX "Terminal_barberId_idx" ON "Terminal"("barberId");
CREATE INDEX "Terminal_deletedAt_idx" ON "Terminal"("deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
