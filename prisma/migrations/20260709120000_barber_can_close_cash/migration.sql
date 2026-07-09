-- AlterTable: barbero encargado que puede cerrar caja
ALTER TABLE "User" ADD COLUMN "canCloseCash" BOOLEAN NOT NULL DEFAULT false;
