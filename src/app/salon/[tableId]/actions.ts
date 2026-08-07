"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { capabilitiesOf } from "@/lib/capabilities";
import { cobrarComanda } from "@/modules/tables/cobrar.use-case";
import { confirmarCarrito, descartarCarrito, findOpenOrder } from "@/modules/tables/orders.repository";
import { agregarProducto, agregarProductoConOpciones, cancelar, quitarProducto } from "@/modules/tables/orders.use-cases";

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

export async function cobrarAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);
  const tableId = texto(formData, "tableId");

  if (!capabilitiesOf(session.user.role).includes("sell")) {
    volver(tableId, "error", "No tenés permiso para cobrar");
  }

  const resultado = await cobrarComanda({
    businessId: session.user.businessId,
    tableId,
    // La propina llega en pesos enteros como todo el resto.
    propina: Number(texto(formData, "propina") || "0"),
    staffId: session.user.id,
  });

  revalidatePath(`/salon/${tableId}`);
  revalidatePath("/salon");
  revalidatePath("/sales");

  if (!resultado.ok) volver(tableId, "error", resultado.error);
  redirect("/salon?estado=ok&mensaje=Mesa+cobrada");
}

export async function agregarConOpcionesAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);

  const tableId = texto(formData, "tableId");
  const productId = texto(formData, "productId");
  const modifierIds = formData.getAll("modifierIds").filter((v): v is string => typeof v === "string");

  const resultado = await agregarProductoConOpciones({
    businessId: session.user.businessId,
    branchId: texto(formData, "branchId"),
    tableId,
    productId,
    modifierIds,
    note: texto(formData, "note") || null,
    staffId: session.user.id,
  });

  revalidatePath(`/salon/${tableId}`);
  revalidatePath("/salon");

  if (!resultado.ok) {
    // Se vuelve a la pantalla de opciones con el motivo: mandarlo a la comanda
    // le esconde qué eligió mal.
    redirect(
      `/salon/${tableId}/opciones/${productId}?${new URLSearchParams({ estado: "error", mensaje: resultado.error })}`,
    );
  }

  redirect(`/salon/${tableId}`);
}

export async function confirmarCarritoAction(formData: FormData) {
  const { session } = await requireModule(AppModule.TABLES);
  const tableId = texto(formData, "tableId");

  const comanda = await findOpenOrder(tableId);
  if (comanda) await confirmarCarrito(comanda.id, session.user.id);

  revalidatePath(`/salon/${tableId}`);
  revalidatePath("/cocina");
  redirect(`/salon/${tableId}`);
}

export async function descartarCarritoAction(formData: FormData) {
  await requireModule(AppModule.TABLES);
  const tableId = texto(formData, "tableId");

  const comanda = await findOpenOrder(tableId);
  if (comanda) await descartarCarrito(comanda.id);

  revalidatePath(`/salon/${tableId}`);
  redirect(`/salon/${tableId}`);
}
