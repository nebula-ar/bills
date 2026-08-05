-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "passwordHash" TEXT,
    "pinHash" TEXT,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "canCloseCash" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" INTEGER NOT NULL DEFAULT 0,
    "sellsAsId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_sellsAsId_fkey" FOREIGN KEY ("sellsAsId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "branchId", "businessId", "canCloseCash", "commissionRate", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "email", "id", "name", "passwordHash", "pinHash", "role", "updatedAt", "updatedById", "username") SELECT "active", "branchId", "businessId", "canCloseCash", "commissionRate", "createdAt", "createdById", "deleted", "deletedAt", "deletedById", "email", "id", "name", "passwordHash", "pinHash", "role", "updatedAt", "updatedById", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_businessId_idx" ON "User"("businessId");
CREATE INDEX "User_branchId_idx" ON "User"("branchId");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE UNIQUE INDEX "User_businessId_email_key" ON "User"("businessId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
