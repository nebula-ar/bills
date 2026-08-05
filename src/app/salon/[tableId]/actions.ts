"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { capabilitiesOf } from "@/lib/capabilities";
import { agregarProducto, cancelar, quitarProducto } from "@/modules/tables/orders.use-cases";

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

function volver(tableId: string, estado: "ok" | "error", mensaje: string): never {
  const params = new URLSearchParams({ estado, mensaje });
  redirect(`/salon/${tableId}?${params.toString()}`);
}

export async function agregarProductoAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);

  const tableId = texto(formData, "tableId");
  const branchId = texto(formData, "branchId");

  const resultado = await agregarProducto({
    businessId: session.user.businessId,
    branchId,
    tableId,
    productId: texto(formData, "productId"),
    unidades: Number(texto(formData, "unidades") || "1"),
    note: texto(formData, "note") || null,
    staffId: session.user.id,
  });

  revalidatePath(`/salon/${tableId}`);
  revalidatePath("/salon");

  // Sin mensaje cuando sale bien: agregar productos es lo que más se toca en
  // esta pantalla, y un cartel por cada toque tapa la comanda.
  if (!resultado.ok) volver(tableId, "error", resultado.error);
  redirect(`/salon/${tableId}`);
}

export async function quitarProductoAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);
  const tableId = texto(formData, "tableId");

  const resultado = await quitarProducto({
    tableId,
    itemId: texto(formData, "itemId"),
    staffId: session.user.id,
  });

  revalidatePath(`/salon/${tableId}`);
  revalidatePath("/salon");

  if (!resultado.ok) volver(tableId, "error", resultado.error);
  redirect(`/salon/${tableId}`);
}

export async function cancelarComandaAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);
  const tableId = texto(formData, "tableId");

  const resultado = await cancelar({
    tableId,
    capacidades: capabilitiesOf(session.user.role),
    staffId: session.user.id,
  });

  revalidatePath(`/salon/${tableId}`);
  revalidatePath("/salon");

  if (!resultado.ok) volver(tableId, "error", resultado.error);
  redirect("/salon?estado=ok&mensaje=Comanda+cancelada");
}
