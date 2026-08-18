"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { consumoDeProduccion, costoDeReceta, faltantesParaProducir } from "@/modules/tables/recipes";
import { findReceta, findStockDeInsumos, registrarProduccion } from "@/modules/tables/recipes.repository";

/**
 * Registrar una tanda, desde el catálogo.
 *
 * La pantalla `/produccion` pedía el producto en un `select` y registraba de
 * una: el stock se movía sin que nadie viera qué se iba a descontar. Acá se
 * calcula primero y se confirma después.
 *
 * Que se pueda ver antes no es un lujo: producir descuenta insumos de verdad y
 * anular una tanda no existe —habría que compensar a mano cada movimiento—, así
 * que la única oportunidad de darse cuenta del error es antes de apretar.
 */

export type RenglonDeConsumo = {
  ingredienteId: string;
  nombre: string;
  unit: string;
  /** Cuánto se va a descontar en total, en milésimas. */
  consume: number;
  /** Cuánto hay en la sucursal, en milésimas. */
  hay: number;
  /** Cuánto falta para poder hacerlo, en milésimas. 0 = alcanza. */
  falta: number;
};

export type PreviewDeProduccion = {
  renglones: RenglonDeConsumo[];
  /** Costo de los insumos de toda la tanda, en pesos enteros. */
  costo: number;
  /** Con lo que hay, cuántas unidades se podrían hacer como máximo. */
  alcanzaPara: number;
  alcanza: boolean;
};

export type PreviewResult = { ok: true; preview: PreviewDeProduccion } | { ok: false; error: string };
export type ProduccionResult = { ok: true; unidades: number; nombre: string } | { ok: false; error: string };

async function armarPreview(businessId: string, productId: string, branchId: string, unidades: number) {
  const receta = await findReceta(businessId, productId);

  if (receta.length === 0) {
    return null;
  }

  const renglones = receta.map((renglon) => ({
    ingredienteId: renglon.ingredientId,
    cantidad: renglon.quantity,
    costoPorUnidad: renglon.ingredient.cost,
  }));

  const stock = Object.fromEntries(
    (await findStockDeInsumos(branchId, receta.map((r) => r.ingredientId))).map((nivel) => [
      nivel.productId,
      nivel.quantity,
    ]),
  );

  const consumo = consumoDeProduccion(renglones, unidades);
  const faltantes = faltantesParaProducir(renglones, unidades, stock);
  const faltaPorInsumo = new Map(faltantes.map((f) => [f.ingredienteId, f.falta]));

  const detalle: RenglonDeConsumo[] = consumo.map((linea) => {
    const original = receta.find((r) => r.ingredientId === linea.ingredienteId);

    return {
      ingredienteId: linea.ingredienteId,
      nombre: original?.ingredient.name ?? "Insumo",
      unit: original?.ingredient.unit ?? "UNIT",
      consume: linea.cantidad,
      hay: stock[linea.ingredienteId] ?? 0,
      falta: faltaPorInsumo.get(linea.ingredienteId) ?? 0,
    };
  });

  // Cuántas se pueden hacer con lo que hay: manda el insumo que menos alcanza,
  // porque la receta los necesita a todos. Enteras, y nunca negativo: el stock
  // puede quedar bajo cero —se vendió más de lo que figuraba— pero "alcanza
  // para −4" no significa nada.
  const alcances = renglones.map((renglon) =>
    renglon.cantidad > 0 ? Math.max(0, Math.floor((stock[renglon.ingredienteId] ?? 0) / renglon.cantidad)) : null,
  );
  const conocidos = alcances.filter((n): n is number => n !== null);

  return {
    renglones: detalle,
    costo: costoDeReceta(renglones) * unidades,
    alcanzaPara: conocidos.length > 0 ? Math.min(...conocidos) : 0,
    alcanza: faltantes.length === 0,
  };
}

export async function previewProduction(input: {
  productId: string;
  branchId: string;
  unidades: number;
}): Promise<PreviewResult> {
  const { session } = await requireModule(AppModule.RECIPES);

  if (!Number.isInteger(input.unidades) || input.unidades <= 0) {
    return { ok: false, error: "Poné cuántas unidades vas a hacer." };
  }

  try {
    const preview = await armarPreview(session.user.businessId, input.productId, input.branchId, input.unidades);

    if (!preview) {
      return { ok: false, error: "Ese producto todavía no tiene receta cargada." };
    }

    return { ok: true, preview };
  } catch (error) {
    await logError("production.preview", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, branchId: input.branchId },
    });
    return { ok: false, error: "No pudimos calcular la tanda." };
  }
}

export async function registerProduction(input: {
  productId: string;
  branchId: string;
  unidades: number;
  nombre: string;
}): Promise<ProduccionResult> {
  const { session } = await requireModule(AppModule.RECIPES);

  if (!Number.isInteger(input.unidades) || input.unidades <= 0) {
    return { ok: false, error: "Poné cuántas unidades saliste a hacer." };
  }

  try {
    // Se recalcula del lado del servidor en vez de confiar en lo que el
    // navegador mostró: entre que se vio el resumen y se confirmó pudo entrar
    // una venta que consumió el mismo insumo.
    const preview = await armarPreview(session.user.businessId, input.productId, input.branchId, input.unidades);

    if (!preview) {
      return { ok: false, error: "Ese producto todavía no tiene receta cargada." };
    }

    if (!preview.alcanza) {
      // Se dice CUÁNTO falta y de qué, no solo que falta: el panadero necesita
      // saber si son 200 gramos o 20 kilos para decidir si sale a comprar o
      // cambia el plan.
      const detalle = preview.renglones
        .filter((renglon) => renglon.falta > 0)
        .map((renglon) => `${renglon.nombre} (faltan ${(renglon.falta / 1000).toLocaleString("es-AR")})`)
        .join(", ");

      return { ok: false, error: `No alcanza el stock: ${detalle}` };
    }

    await registrarProduccion({
      businessId: session.user.businessId,
      branchId: input.branchId,
      productId: input.productId,
      unidades: input.unidades * 1000,
      consumo: preview.renglones.map((renglon) => ({
        ingredienteId: renglon.ingredienteId,
        cantidad: renglon.consume,
      })),
      staffId: session.user.id,
    });

    return { ok: true, unidades: input.unidades, nombre: input.nombre };
  } catch (error) {
    await logError("production.register", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, branchId: input.branchId, unidades: input.unidades },
    });
    return { ok: false, error: "No pudimos registrar la tanda. Intentá de nuevo." };
  }
}
