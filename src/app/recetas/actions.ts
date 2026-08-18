"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppModule, Unit } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { parseAmountInput } from "@/lib/money";
import { parseQuantityInput } from "@/lib/quantity";
import {
  crearInsumo,
  findReceta,
  findStockDeInsumos,
  ponerEnReceta,
  ponerVencimiento,
  registrarProduccion,
  sacarDeReceta,
} from "@/modules/tables/recipes.repository";
import { consumoDeProduccion, faltantesParaProducir } from "@/modules/tables/recipes";

function texto(formData: FormData, key: string) {
  const valor = formData.get(key);
  return typeof valor === "string" ? valor.trim() : "";
}

function volver(ruta: string, estado: "ok" | "error", mensaje: string, extra = ""): never {
  redirect(`${ruta}?${new URLSearchParams({ estado, mensaje })}${extra}`);
}

export async function crearInsumoAction(formData: FormData) {
  const { session } = await requireModule(AppModule.RECIPES);

  const name = texto(formData, "name");
  if (!name) volver("/recetas", "error", "Poné un nombre para el insumo");

  await crearInsumo({
    businessId: session.user.businessId,
    name,
    unit: (texto(formData, "unit") || Unit.KG) as Unit,
    // El costo es por unidad entera (por kilo, por litro).
    cost: parseAmountInput(texto(formData, "cost") || "0") ?? null,
    minStock: parseQuantityInput(texto(formData, "minStock") || "0"),
    userId: session.user.id,
  });

  revalidatePath("/recetas");
  volver("/recetas", "ok", "Insumo creado");
}

export async function ponerEnRecetaAction(formData: FormData) {
  const { session } = await requireModule(AppModule.RECIPES);

  const productId = texto(formData, "productId");
  const cantidad = parseQuantityInput(texto(formData, "quantity"), Unit.KG);

  if (cantidad === null || cantidad <= 0) {
    volver("/recetas", "error", "Poné cuánto lleva, mayor que cero", `&producto=${productId}`);
  }

  await ponerEnReceta({
    productId,
    businessId: session.user.businessId,
    ingredientId: texto(formData, "ingredientId"),
    quantity: cantidad,
  });

  revalidatePath("/recetas");
  volver("/recetas", "ok", "Receta actualizada", `&producto=${productId}`);
}

export async function sacarDeRecetaAction(formData: FormData) {
  const { session } = await requireModule(AppModule.RECIPES);

  const productId = texto(formData, "productId");
  await sacarDeReceta(texto(formData, "recipeItemId"), session.user.businessId);

  revalidatePath("/recetas");
  volver("/recetas", "ok", "Insumo quitado de la receta", `&producto=${productId}`);
}

export async function producirAction(formData: FormData) {
  const { session } = await requireModule(AppModule.RECIPES);

  const branchId = texto(formData, "branchId");
  const productId = texto(formData, "productId");
  const unidades = Number(texto(formData, "unidades") || "0");

  if (!Number.isInteger(unidades) || unidades <= 0) {
    volver("/produccion", "error", "Poné cuántas unidades saliste a hacer");
  }

  const receta = await findReceta(session.user.businessId, productId);
  if (receta.length === 0) {
    volver("/produccion", "error", "Ese producto todavía no tiene receta cargada");
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
    volver("/produccion", "error", `No alcanza el stock: ${detalle}`);
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
  volver("/produccion", "ok", `Producción registrada: ${unidades} unidades`);
}

export async function ponerVencimientoAction(formData: FormData) {
  await requireModule(AppModule.RECIPES);

  const crudo = texto(formData, "expiresAt");

  await ponerVencimiento({
    branchId: texto(formData, "branchId"),
    productId: texto(formData, "productId"),
    // Vacío = se limpia. Cargar una fecha por error y no poder sacarla es peor
    // que no tener el campo.
    expiresAt: crudo ? new Date(`${crudo}T00:00:00Z`) : null,
  });

  revalidatePath("/recetas");
  volver("/recetas", "ok", crudo ? "Vencimiento guardado" : "Vencimiento borrado");
}
