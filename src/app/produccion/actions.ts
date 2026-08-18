"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { findReceta, findStockDeInsumos, registrarProduccion } from "@/modules/tables/recipes.repository";
import { consumoDeProduccion, faltantesParaProducir } from "@/modules/tables/recipes";

/**
 * Registrar una tanda.
 *
 * Vivía en `/recetas/actions.ts`, que se eliminó junto con esa pantalla: la
 * receta pasó a editarse desde la ficha del producto. Producir sigue siendo
 * una operación del día y multi-producto, así que se queda con su pantalla.
 */

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

function volver(estado: "ok" | "error", mensaje: string): never {
  redirect(`/produccion?${new URLSearchParams({ estado, mensaje })}`);
}

export async function producirAction(formData: FormData) {
  const { session } = await requireModule(AppModule.RECIPES);

  const branchId = texto(formData, "branchId");
  const productId = texto(formData, "productId");
  const unidades = Number(texto(formData, "unidades") || "0");

  if (!Number.isInteger(unidades) || unidades <= 0) {
    volver("error", "Poné cuántas unidades saliste a hacer");
  }

  const receta = await findReceta(session.user.businessId, productId);
  if (receta.length === 0) {
    volver("error", "Ese producto todavía no tiene receta cargada");
  }

  const renglones = receta.map((r) => ({
    ingredienteId: r.ingredientId,
    cantidad: r.quantity,
    costoPorUnidad: r.ingredient.cost,
  }));

  const stock = Object.fromEntries(
    (await findStockDeInsumos(branchId, receta.map((r) => r.ingredientId))).map((s) => [
      s.productId,
      s.quantity,
    ]),
  );

  // Avisa CUÁNTO falta, no solo que falta: el panadero necesita saber si son
  // 200 gramos o 20 kilos para decidir si sale a comprar o cambia el plan.
  const faltantes = faltantesParaProducir(renglones, unidades, stock);
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map((f) => {
        const r = receta.find((x) => x.ingredientId === f.ingredienteId);
        return `${r?.ingredient.name ?? "insumo"} (faltan ${(f.falta / 1000).toLocaleString("es-AR")})`;
      })
      .join(", ");
    volver("error", `No alcanza el stock: ${detalle}`);
  }

  await registrarProduccion({
    businessId: session.user.businessId,
    branchId,
    productId,
    unidades: unidades * 1000,
    consumo: consumoDeProduccion(renglones, unidades),
    staffId: session.user.id,
  });

  revalidatePath("/produccion");
  revalidatePath("/stock");
  // La existencia también se ve en /catalog ahora (ver ProductsManager).
  revalidatePath("/catalog");
  volver("ok", `Producción registrada: ${unidades} unidades`);
}
