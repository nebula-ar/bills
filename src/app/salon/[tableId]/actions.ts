"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { capabilitiesOf } from "@/lib/capabilities";
import { confirmarCarrito, descartarCarrito, findOpenOrder } from "@/modules/tables/orders.repository";
import {
  agregarProducto,
  agregarProductoConOpciones,
  cancelar,
  quitarProducto,
  restarUnidad,
  type Resultado,
} from "@/modules/tables/orders.use-cases";

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

// Sin `redirect()`, a diferencia del resto de las acciones de esta pantalla:
// agregar productos es lo que MÁS se toca acá, y una navegación completa por
// toque es el parpadeo que hace que se sienta distinta al mostrador (que
// agrega en memoria y no vuelve a pedir la página). El cliente refresca solo,
// con `router.refresh()`, que no navega ni pierde el scroll.
export async function agregarProductoRapido(input: {
  tableId: string;
  branchId: string;
  productId: string;
}): Promise<Resultado> {
  const { session } = await requireModule(AppModule.TABLES);

  const resultado = await agregarProducto({
    businessId: session.user.businessId,
    branchId: input.branchId,
    tableId: input.tableId,
    productId: input.productId,
    unidades: 1,
    note: null,
    staffId: session.user.id,
  });

  if (resultado.ok) {
    revalidatePath(`/salon/${input.tableId}`);
    revalidatePath("/salon");
  }

  return resultado;
}

// Igual que `agregarProductoRapido`: sin `redirect()`. Redirigir a la MISMA
// ruta que ya está en pantalla no vuelve a pedir el árbol en este fork de
// Next —es la causa documentada de los ajustes de stock que "no se
// aplicaban"—, así que quitar y cancelar se quedaban escritos en la base
// pero invisibles en la pantalla. El cliente llama a `router.refresh()`.
export async function quitarProductoAction(input: { tableId: string; itemId: string }): Promise<Resultado> {
  const { session } = await requireModule(AppModule.TABLES);

  const resultado = await quitarProducto({
    tableId: input.tableId,
    itemId: input.itemId,
    staffId: session.user.id,
  });

  if (resultado.ok) {
    revalidatePath(`/salon/${input.tableId}`);
    revalidatePath("/salon");
  }

  return resultado;
}

export async function restarUnidadAction(input: { tableId: string; itemId: string }): Promise<Resultado> {
  const { session } = await requireModule(AppModule.TABLES);

  const resultado = await restarUnidad({
    tableId: input.tableId,
    itemId: input.itemId,
    staffId: session.user.id,
  });

  if (resultado.ok) {
    revalidatePath(`/salon/${input.tableId}`);
    revalidatePath("/salon");
  }

  return resultado;
}

export async function cancelarComandaAction(input: { tableId: string }): Promise<Resultado> {
  const { session } = await requireModule(AppModule.TABLES);

  const resultado = await cancelar({
    tableId: input.tableId,
    capacidades: capabilitiesOf(session.user.role),
    staffId: session.user.id,
  });

  if (resultado.ok) {
    revalidatePath(`/salon/${input.tableId}`);
    revalidatePath("/salon");
  }

  return resultado;
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

export async function confirmarCarritoAction(input: { tableId: string }): Promise<Resultado> {
  const { session } = await requireModule(AppModule.TABLES);

  const comanda = await findOpenOrder(input.tableId);
  if (!comanda) return { ok: false, error: "Esta mesa no tiene una comanda abierta" };

  await confirmarCarrito(comanda.id, session.user.id);

  revalidatePath(`/salon/${input.tableId}`);
  revalidatePath("/cocina");
  return { ok: true };
}

export async function descartarCarritoAction(input: { tableId: string }): Promise<Resultado> {
  await requireModule(AppModule.TABLES);

  const comanda = await findOpenOrder(input.tableId);
  if (!comanda) return { ok: false, error: "Esta mesa no tiene una comanda abierta" };

  await descartarCarrito(comanda.id);

  revalidatePath(`/salon/${input.tableId}`);
  return { ok: true };
}
