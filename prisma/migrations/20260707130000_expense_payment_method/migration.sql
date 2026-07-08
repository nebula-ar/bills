-- AlterTable: cuenta de la que salió el gasto (concilia con métodos de pago)
ALTER TABLE "Expense" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CASH';
