-- CreateTable
CREATE TABLE "AiImageDailyUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiImageDailyUsage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AiImageDailyUsage_businessId_day_key" ON "AiImageDailyUsage"("businessId", "day");

-- CreateIndex
CREATE INDEX "AiImageDailyUsage_day_idx" ON "AiImageDailyUsage"("day");
