-- CreateTable
CREATE TABLE "AiImageDailyUsage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiImageDailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiImageDailyUsage_businessId_day_key" ON "AiImageDailyUsage"("businessId", "day");

-- CreateIndex
CREATE INDEX "AiImageDailyUsage_day_idx" ON "AiImageDailyUsage"("day");

-- AddForeignKey
ALTER TABLE "AiImageDailyUsage" ADD CONSTRAINT "AiImageDailyUsage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
