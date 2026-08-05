-- AlterTable
ALTER TABLE "Product" ADD COLUMN "imageUpdatedAt" DATETIME;

-- CreateTable
CREATE TABLE "ProductImage" (
    "productId" TEXT NOT NULL PRIMARY KEY,
    "data" BLOB NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
