"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { parseQuantityInput } from "@/lib/quantity";
import {
  findInsumoDelNegocio,
  findRecetaDeProducto,
  ponerEnReceta,
  sacarDeReceta,
} from "@/modules/tables/recipes.repository";
import { desglosarReceta } from "@/modules/tables/recipes";

/**
 * La receta de un producto, editada desde su propia ficha.
 *
 * Vivía en `/recetas`, una pantalla que te obligaba a elegir en un modal el
 * producto que ya estabas mirando. La receta es del producto: se resuelve donde
 * está el producto (ver AGENTS.md).
 *
 * Todo devuelve resultado en vez de redirigir. El `redirect()` a la misma ruta
 * NO vuelve a pedir el árbol: la pantalla se quedaría con la receta de antes
 * aunque la base ya esté escrita. El cliente llama `router.refresh()`.
 */

const genericError = "No pudimos guardar la receta. Intentá de nuevo.";

export type RenglonDeRecetaView = {
  id: string;
  ingredienteId: string;
  nombre: string;
  unit: string;
  /** Cuánto lleva UNA unidad, en milésimas de la unidad del insumo. */
  cantidad: number;
  costo: number;
  porcentaje: number;
  sinCosto: boolean;
  costoUnitario: number | null;
  /** Existencia del insumo en la sucursal, en milésimas. */
  hay: number;
  /** Para cuántas unidades enteras alcanza este insumo. null = no limita. */
  alcanzaPara: number | null;
};

export type RecetaView = {
  renglones: RenglonDeRecetaView[];
  costo: number;
  /** Cuántos insumos no tienen costo: el total está incompleto por esos. */
  sinCostear: number;
  /** Con lo que hay, cuántas unidades se pueden hacer. null = no se sabe. */
  alcanzaTotal: number | null;
};

export type RecetaResult = { ok: true; receta: RecetaView } | { ok: false; error: string };
export type RecetaMutationResult = { ok: true } | { ok: false; error: string };

export async function getProductRecipe(productId: string, branchId: string): Promise<RecetaResult> {
  const { session } = await requireModule(AppModule.RECIPES);

  try {
    const producto = await findRecetaDeProducto(session.user.businessId, productId, branchId);

    if (!producto) {
      return { ok: false, error: "No encontramos ese producto." };
    }

    const desglose = desglosarReceta(
      producto.receta.map((renglon) => ({
        ingredienteId: renglon.ingredient.id,
        cantidad: renglon.quantity,
        costoPorUnidad: renglon.ingredient.cost,
      })),
    );

    const renglones: RenglonDeRecetaView[] = producto.receta.map((renglon, indice) => {
      const hay = renglon.ingredient.stockLevels?.[0]?.quantity ?? 0;

      return {
        id: renglon.id,
        ingredienteId: renglon.ingredient.id,
        nombre: renglon.ingredient.name,
        unit: renglon.ingredient.unit,
        cantidad: renglon.quantity,
        costo: desglose.renglones[indice]?.costo ?? 0,
        porcentaje: desglose.renglones[indice]?.porcentaje ?? 0,
        sinCosto: desglose.renglones[indice]?.sinCosto ?? false,
        costoUnitario: renglon.ingredient.cost,
        hay,
        // Enteras: media medialuna no se produce. Un renglón en cero no limita
        // nada, así que no se divide por él. Y nunca negativo: el stock puede
        // quedar bajo cero —se vendió más de lo que figuraba— pero "alcanza
        // para −4" no significa nada.
        alcanzaPara: renglon.quantity > 0 ? Math.max(0, Math.floor(hay / renglon.quantity)) : null,
      };
    });

    // Manda el insumo que menos alcanza, porque la receta los necesita a todos.
    // Es el número que decide si hay que salir a comprar.
    const alcances = renglones.map((r) => r.alcanzaPara).filter((n): n is number => n !== null);
    const alcanzaTotal = alcances.length === renglones.length && alcances.length > 0 ? Math.min(...alcances) : null;

    return {
      ok: true,
      receta: { renglones, costo: desglose.total, sinCostear: desglose.sinCostear, alcanzaTotal },
    };
  } catch (error) {
    await logError("recipe.read", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId, branchId },
    });
    return { ok: false, error: "No pudimos leer la receta." };
  }
}

export async function saveRecipeItem(input: {
  productId: string;
  ingredientId: string;
  /** Cuánto lleva una unidad, tal cual lo tipeó el dueño. */
  cantidad: string;
}): Promise<RecetaMutationResult> {
  const { session } = await requireModule(AppModule.RECIPES);

  try {
    // La unidad sale del insumo, no de una constante. La acción vieja parseaba
    // SIEMPRE con `Unit.KG`, así que en un insumo que se cuenta por unidad
    // —huevos, por ejemplo— aceptaba "1,5" y guardaba media docena de algo que
    // no se puede partir.
    const insumo = await findInsumoDelNegocio(session.user.businessId, input.ingredientId);

    if (!insumo) {
      return { ok: false, error: "Ese insumo no existe o no es de este negocio." };
    }

    const cantidad = parseQuantityInput(input.cantidad, insumo.unit);

    if (cantidad === null || cantidad <= 0) {
      return { ok: false, error: `Poné cuánto lleva de ${insumo.name}, mayor que cero.` };
    }

    await ponerEnReceta({
      productId: input.productId,
      businessId: session.user.businessId,
      ingredientId: input.ingredientId,
      quantity: cantidad,
    });

    return { ok: true };
  } catch (error) {
    await logError("recipe.save", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, ingredientId: input.ingredientId },
    });
    return { ok: false, error: genericError };
  }
}

export async function removeRecipeItem(recipeItemId: string): Promise<RecetaMutationResult> {
  const { session } = await requireModule(AppModule.RECIPES);

  try {
    await sacarDeReceta(recipeItemId, session.user.businessId);
    return { ok: true };
  } catch (error) {
    await logError("recipe.remove", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { recipeItemId },
    });
    return { ok: false, error: genericError };
  }
}
