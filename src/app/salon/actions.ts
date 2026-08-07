"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule, TableStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { alternarOcupacion, crearMesa, crearSector } from "@/modules/tables/tables.use-cases";

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Vuelve al tablero con el resultado a la vista.
 *
 * El sector queda en la URL para que después de crear una mesa el mozo siga
 * parado donde estaba: mandarlo al primer sector le hace pensar que la mesa se
 * creó en otro lado, que es exactamente el bug que ya vivimos en Migas.
 */
function volver(branchId: string, sectorId: string, estado: "ok" | "error", mensaje: string): never {
  const params = new URLSearchParams({ estado, mensaje });
  if (branchId) params.set("branchId", branchId);
  if (sectorId) params.set("sector", sectorId);

  redirect(`/salon?${params.toString()}`);
}

export async function crearSectorAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);
  const branchId = texto(formData, "branchId");

  const resultado = await crearSector({
    businessId: session.user.businessId,
    branchId,
    name: texto(formData, "name"),
    userId: session.user.id,
  });

  revalidatePath("/salon");

  if (!resultado.ok) volver(branchId, "", "error", resultado.error);

  // Se vuelve PARADO en el sector nuevo: si no, la mesa que se cree a
  // continuación parece perderse.
  volver(branchId, resultado.sectorId ?? "", "ok", "Sector creado");
}

export async function crearMesaAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);
  const branchId = texto(formData, "branchId");
  const sectorId = texto(formData, "sectorId");
  const seats = Number(texto(formData, "seats") || "4");

  const resultado = await crearMesa({
    businessId: session.user.businessId,
    branchId,
    sectorId: sectorId || null,
    name: texto(formData, "name"),
    seats,
    userId: session.user.id,
  });

  revalidatePath("/salon");
  volver(branchId, sectorId, resultado.ok ? "ok" : "error", resultado.ok ? "Mesa creada" : resultado.error);
}

export async function alternarOcupacionAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);
  const branchId = texto(formData, "branchId");
  const sectorId = texto(formData, "sectorId");

  const resultado = await alternarOcupacion({
    tableId: texto(formData, "tableId"),
    status: texto(formData, "status") as TableStatus,
    tieneComandaAbierta: texto(formData, "tieneComanda") === "1",
    userId: session.user.id,
  });

  revalidatePath("/salon");
  volver(branchId, sectorId, resultado.ok ? "ok" : "error", resultado.ok ? "Mesa actualizada" : resultado.error);
}
