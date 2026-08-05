"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { agregarDesdeCarta, quitarDelCarrito } from "@/modules/tables/carta-publica.use-case";

/**
 * Acciones de la carta pública. SIN sesión: el token de la mesa es lo único
 * que autentica, así que todo se valida del lado del servidor.
 */

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function agregarDesdeCartaAction(formData: FormData) {
  const token = texto(formData, "token");

  const resultado = await agregarDesdeCarta({
    token,
    productId: texto(formData, "productId"),
    modifierIds: formData.getAll("modifierIds").filter((v): v is string => typeof v === "string"),
    note: texto(formData, "note") || null,
  });

  revalidatePath(`/carta/${token}`);

  if (!resultado.ok) {
    redirect(`/carta/${token}?${new URLSearchParams({ estado: "error", mensaje: resultado.error })}`);
  }
  redirect(`/carta/${token}`);
}

export async function quitarDelCarritoAction(formData: FormData) {
  const token = texto(formData, "token");

  const resultado = await quitarDelCarrito({ token, itemId: texto(formData, "itemId") });

  revalidatePath(`/carta/${token}`);

  if (!resultado.ok) {
    redirect(`/carta/${token}?${new URLSearchParams({ estado: "error", mensaje: resultado.error })}`);
  }
  redirect(`/carta/${token}`);
}
