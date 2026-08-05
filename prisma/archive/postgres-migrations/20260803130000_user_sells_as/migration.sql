-- Gemela de `prisma/migrations/20260803112446_user_sells_as`.
--
-- En SQLite Prisma reconstruye la tabla entera (no sabe agregar una foreign key
-- a una tabla existente); en Postgres alcanza con la columna y la constraint.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sellsAsId" TEXT;

-- AddForeignKey
-- Autorreferencia: el usuario que loguea apunta a la fila con la que vende.
-- SET NULL y no CASCADE: borrar al empleado deja al dueño sin identidad de
-- venta, no sin cuenta.
ALTER TABLE "User" ADD CONSTRAINT "User_sellsAsId_fkey"
    FOREIGN KEY ("sellsAsId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
