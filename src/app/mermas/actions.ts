"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { parseQuantityInput } from "@/lib/quantity";
import { registrarMerma } from "@/modules/tables/recipes.repository";

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

function volver(estado: "ok" | "error", mensaje: string): never {
  redirect(`/mermas?${new URLSearchParams({ estado, mensaje })}`);
}

export async function registrarMermaAction(formData: FormData) {
  const { session } = await requireModule(AppModule.RECIPES);

  const cantidad = parseQuantityInput(texto(formData, "cantidad"));
  if (cantidad === null || cantidad <= 0) volver("error", "Poné cuánto se tiró, mayor que cero");

  // El motivo es obligatorio: "se tiraron 3 kg" sin decir por qué es un número
  // que nadie puede accionar.
  const motivo = texto(formData, "motivo");
  if (!motivo) volver("error", "Poné por qué se tiró");

  await registrarMerma({
    businessId: session.user.businessId,
    branchId: texto(formData, "branchId"),
    productId: texto(formData, "productId"),
    cantidad,
    motivo,
    staffId: session.user.id,
  });

  revalidatePath("/mermas");
  revalidatePath("/stock");
  // La existencia también se ve en /catalog ahora (ver ProductsManager).
  revalidatePath("/catalog");
  volver("ok", "Merma anotada");
}
