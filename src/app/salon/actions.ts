"use server";

import { revalidatePath } from "next/cache";

import { AppModule, TableStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { alternarOcupacion, crearMesa, crearSector, type Resultado } from "@/modules/tables/tables.use-cases";

// Sin `redirect()`: `/salon?estado=...&mensaje=...` es la MISMA ruta que ya
// está en pantalla, y en este fork de Next eso no vuelve a pedir el árbol
// (la causa ya documentada de los ajustes de stock que "no se aplicaban", y
// la misma que tenían quitar/cancelar en la comanda). Las tres devuelven
// Resultado y el cliente llama a `router.refresh()`.
export async function crearSectorAction(input: { branchId: string; name: string }): Promise<Resultado & { sectorId?: string }> {
  const { session } = await requireModule(AppModule.TABLES);

  const resultado = await crearSector({
    businessId: session.user.businessId,
    branchId: input.branchId,
    name: input.name,
    userId: session.user.id,
  });

  if (resultado.ok) revalidatePath("/salon");

  return resultado;
}

export async function crearMesaAction(input: {
  branchId: string;
  sectorId: string | null;
  name: string;
  seats: number;
}): Promise<Resultado> {
  const { session } = await requireModule(AppModule.TABLES);

  const resultado = await crearMesa({
    businessId: session.user.businessId,
    branchId: input.branchId,
    sectorId: input.sectorId,
    name: input.name,
    seats: input.seats,
    userId: session.user.id,
  });

  if (resultado.ok) revalidatePath("/salon");

  return resultado;
}

export async function alternarOcupacionAction(input: {
  tableId: string;
  status: TableStatus;
  tieneComandaAbierta: boolean;
}): Promise<Resultado> {
  const { session } = await requireModule(AppModule.TABLES);

  const resultado = await alternarOcupacion({
    tableId: input.tableId,
    status: input.status,
    tieneComandaAbierta: input.tieneComandaAbierta,
    userId: session.user.id,
  });

  if (resultado.ok) revalidatePath("/salon");

  return resultado;
}
