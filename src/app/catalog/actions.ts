"use server";

import { AppModule, ProductKind, Unit } from "@/generated/prisma/client";
import type { ProductChangeField, StockMovementType } from "@/generated/prisma/enums";
import { requireAdminSession } from "@/lib/auth";
import { requireBusinessContext } from "@/lib/business-context";
import { verticalFeatures } from "@/lib/vertical";
import { parseQuantityInput } from "@/lib/quantity";
import { logError } from "@/lib/logger";
import { getProductErrorMessage } from "@/lib/catalog-error-messages";
import {
  costoPorUnidad,
  kindParaAlta,
  parseCommercialFields,
  parseOptionalString,
  parsePrice,
  parseRequiredString,
  parseWholeAmount,
  quiereConfigurarSucursal,
} from "@/modules/catalog/catalog-form.logic";
import { createFullProduct } from "@/modules/catalog/create-full-product.use-case";
import { ProductError } from "@/modules/catalog/product.errors";
import { updateGlobalProduct } from "@/modules/catalog/update-product.use-case";
import { findProductChanges } from "@/modules/catalog/product.repository";
import { removeProductImage, saveProductImage } from "@/modules/catalog/product-image.use-case";
import { upsertBranchProductConfiguration } from "@/modules/catalog/upsert-branch-product-config.use-case";
import {
  analizarProductoEnPeriodo,
  rendimientoDeProducto,
  serieDiariaDeProducto,
} from "@/modules/catalog/product-analytics.use-case";
import { parsePeriodo as parsePeriodoDeAnalisis, rangoDelPeriodo } from "@/modules/sales/sales-period.logic";
import { findBranchForStock, findProductStockMovements } from "@/modules/stock/stock.repository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar el ítem. Intentá de nuevo.";

export type CreateProductResult =
  | { ok: true; productId: string; name: string; description: string | null }
  | { ok: false; error: string };

export async function createProduct(formData: FormData): Promise<CreateProductResult> {
  const { session, business } = await requireBusinessContext();

  const branchId = parseRequiredString(formData, "branchId");
  const name = parseRequiredString(formData, "name");
  const priceRaw = formData.get("price");
  const price = parsePrice(priceRaw);
  const priceEntered = typeof priceRaw === "string" && priceRaw.trim().length > 0;

  if (!branchId || !name) {
    return { ok: false, error: "Completá el nombre del ítem." };
  }

  if (priceEntered && !price) {
    return { ok: false, error: "Poné un precio válido para la sucursal." };
  }

  const description = parseOptionalString(formData, "description") ?? null;
  const costRaw = parseOptionalString(formData, "cost");
  const stockRaw = parseOptionalString(formData, "stock");

  // Qué es lo que se está dando de alta (ver `kindParaAlta`). El insumo se pide
  // explícito y solo existe con Recetas prendido: sin el módulo nadie tiene por
  // qué poder crear un producto que no se vende.
  const features = verticalFeatures(business.vertical);
  const esInsumo = formData.get("esInsumo") === "true" && business.has(AppModule.RECIPES);

  // Cómo se mide. Hasta acá el alta NUNCA mandaba la unidad, así que todo caía
  // en el default `UNIT` — y `UNIT` no admite fracciones: una bolsa de "25,5"
  // kg se parseaba a null y el producto quedaba con existencia cero sin que
  // nadie se enterara. En un insumo además arruina la receta, porque
  // `RecipeItem.quantity` son milésimas DE LA UNIDAD DEL INSUMO: con la harina
  // en unidades, 120 deja de ser 0,12 kg y el costo del budín sale mal sin que
  // falle nada.
  const unitRaw = parseOptionalString(formData, "unit");
  const unit =
    unitRaw && (Object.values(Unit) as string[]).includes(unitRaw) ? (unitRaw as Unit) : Unit.UNIT;

  // La cantidad se tipea en unidades y se guarda en milésimas, igual que todo
  // lo demás (ver src/lib/quantity.ts).
  const stock = stockRaw ? parseQuantityInput(stockRaw, unit) : null;
  const kind = kindParaAlta({ esInsumo, vendeMercaderia: features.goods, stock });

  // El insumo se compra por bulto y la receta lo cuenta por unidad: se pregunta
  // lo que pagó por la bolsa y cuánto trae, y la división la hace el sistema.
  // Para todo lo demás el costo se tipea directo, como siempre.
  const bultoRaw = parseOptionalString(formData, "bultoTrae");
  const cost = esInsumo
    ? costoPorUnidad({
        precioDelBulto: costRaw ? parseWholeAmount(costRaw) : null,
        cuantoTrae: bultoRaw ? parseQuantityInput(bultoRaw, unit) : null,
      })
    : costRaw
      ? parseWholeAmount(costRaw)
      : null;

  try {
    // Un solo camino: el ítem, su precio (si lo puso) y la existencia inicial
    // con su movimiento, todo en una transacción. Es lo que evita que después
    // tenga que ir a Stock a cargar producto por producto lo que ya sabía.
    const product = await createFullProduct({
      businessId: session.user.businessId,
      branchId,
      code: parseOptionalString(formData, "barcode") ?? undefined,
      name,
      description,
      price,
      cost,
      stock,
      unit,
      categoryId: parseOptionalString(formData, "categoryId") ?? null,
      // El insumo lleva stock igual que la mercadería: se compra, se guarda y
      // se consume. Lo único que no hace es venderse.
      trackStock: kind !== ProductKind.SERVICE && business.has(AppModule.STOCK),
      kind,
      reason: "Carga inicial",
      userId: session.user.id,
    });

    revalidatePath("/catalog");
    return { ok: true, productId: product.id, name: product.name, description };
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.create", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { branchId },
    });
    return { ok: false, error: genericErrorMessage };
  }
}

export async function saveBranchProductConfig(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const productId = parseRequiredString(formData, "productId");
  const price = parsePrice(formData.get("price"));
  const active = formData.get("active") === "on";

  if (!branchId || !productId || !price) {
    redirectWithMessage("error", "Completá un precio válido en pesos.", branchId ?? undefined);
  }

  try {
    await upsertBranchProductConfiguration({
      changedById: session.user.id,
      businessId: session.user.businessId,
      branchId,
      productId,
      price,
      active,
    });
  } catch (error) {
    await handleProductActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage("success", "Configuración de sucursal guardada.", branchId);
}

export type ToggleAvailabilityResult = { ok: true; available: boolean } | { ok: false; error: string };

// Prender/apagar la disponibilidad sin abrir la ficha completa: la tabla y el
// panel rápido de Productos lo usan para no perder el lugar en la lista al
// tocar un toggle (mismo espíritu que applyProductStockAction en
// stock-actions.ts: devuelve resultado, no redirige, así el caller decide
// cuándo refrescar). Solo tiene sentido sobre un precio YA configurado — sin
// precio no hay nada que vender — así que el toggle llega deshabilitado en
// ese caso y hay que pasar por "Editar producto" para cargarlo primero.
export async function toggleProductAvailability(input: {
  branchId: string;
  productId: string;
  price: number;
  available: boolean;
}): Promise<ToggleAvailabilityResult> {
  const session = await requireAdminSession();

  try {
    await upsertBranchProductConfiguration({
      changedById: session.user.id,
      businessId: session.user.businessId,
      branchId: input.branchId,
      productId: input.productId,
      price: input.price,
      active: input.available,
    });
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.availability", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, branchId: input.branchId },
    });
    return { ok: false, error: "No pudimos actualizar la disponibilidad. Intentá de nuevo." };
  }

  return { ok: true, available: input.available };
}

export type UpdateProductDetailsResult = { ok: true } | { ok: false; error: string };

// Todo lo editable de la ficha —nombre, descripción, costo, tipo, unidad,
// código, SKU, categoría, mínimo, bulto— en un solo guardado desde el panel
// rápido de Productos (ver ProductQuickPanelBody: pestaña "Detalles" y el
// campo Costo, que comparten el mismo <form>). Recibe FormData en vez de un
// objeto tipado para poder reusar `parseCommercialFields` tal cual —mismo
// parseo que ya usaba el formulario completo de antes— en vez de reinventar
// cómo se interpreta cada campo. Nombre y descripción viajan siempre:
// `updateGlobalProduct` no es parcial en esos dos (ver product.repository.ts:
// `description: input.description ?? null` corre SIEMPRE, no solo cuando
// viene definido), así que omitirlos los pisaría a null en vez de dejarlos
// como estaban.
export async function updateProductDetails(formData: FormData): Promise<UpdateProductDetailsResult> {
  const session = await requireAdminSession();

  const productId = parseRequiredString(formData, "productId");
  const name = parseRequiredString(formData, "name");
  const description = parseOptionalString(formData, "description");

  if (!productId || !name) {
    return { ok: false, error: "Completá el nombre del ítem." };
  }

  try {
    await updateGlobalProduct({
      changedById: session.user.id,
      businessId: session.user.businessId,
      productId,
      name,
      description,
      ...parseCommercialFields(formData),
    });
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.details", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId },
    });
    return { ok: false, error: genericErrorMessage };
  }

  revalidatePath("/catalog");
  return { ok: true };
}

export async function updateProduct(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const productId = parseRequiredString(formData, "productId");
  const name = parseRequiredString(formData, "name");
  const description = parseOptionalString(formData, "description");
  const priceRaw = formData.get("price");
  const price = parsePrice(priceRaw);
  const configured = formData.get("configured") === "true";
  const active = formData.get("active") === "on";

  if (!branchId || !productId || !name) {
    redirectWithMessage("error", "Completá el nombre del ítem.", branchId ?? undefined);
  }

  const campos = parseCommercialFields(formData);

  // Un insumo no se configura por sucursal: no tiene precio porque no se vende.
  // El guard vive acá y no solo en el JSX a propósito. La ficha ya no dibuja el
  // precio ni el switch para un insumo, pero un producto que se convirtió a
  // insumo puede arrastrar una configuración de sucursal vieja, y con
  // `configured: true` y sin precio el guardado moría en "Poné un precio válido
  // para configurarlo o habilitarlo": la ficha quedaba imposible de guardar.
  const esInsumo = campos.kind === ProductKind.INGREDIENT;
  const wantsConfig = !esInsumo && quiereConfigurarSucursal({ configured, active, priceRaw });

  if (wantsConfig && !price) {
    redirectWithMessage("error", "Poné un precio válido para configurarlo o habilitarlo.", branchId);
  }

  try {
    await updateGlobalProduct({
      changedById: session.user.id,
      businessId: session.user.businessId,
      productId,
      name,
      description,
      ...campos,
    });

    if (wantsConfig && price) {
      await upsertBranchProductConfiguration({ businessId: session.user.businessId, branchId, productId, price, active });
    }
  } catch (error) {
    await handleProductActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage("success", "Ítem actualizado.", branchId);
}

async function handleProductActionError(
  error: unknown,
  branchId: string | undefined,
  meta: { businessId: string; userId: string },
): Promise<never> {
  if (error instanceof ProductError) {
    redirectWithMessage("error", getProductErrorMessage(error.code), branchId);
  }

  await logError("product.save", error, { businessId: meta.businessId, userId: meta.userId, context: { branchId: branchId ?? null } });
  redirectWithMessage("error", genericErrorMessage, branchId);
}

function redirectWithMessage(status: "error" | "success", message: string, branchId?: string): never {
  const params = new URLSearchParams({ status, message });

  if (branchId) {
    params.set("branchId", branchId);
  }

  redirect(`/catalog?${params.toString()}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Foto del producto
// ─────────────────────────────────────────────────────────────────────────────

export type ProductImageResult = { ok: true; version: number } | { ok: false; error: string };

// Se sube por separado del resto del formulario: así una foto pesada no arrastra
// (ni bloquea) la edición de nombre y precio, y el resultado vuelve sin recargar.
export async function uploadProductImage(formData: FormData): Promise<ProductImageResult> {
  const session = await requireAdminSession();

  const productId = parseRequiredString(formData, "productId");
  const file = formData.get("file");

  if (!productId || !(file instanceof File)) {
    return { ok: false, error: "Elegí una foto para subir." };
  }

  try {
    await saveProductImage({
      businessId: session.user.businessId,
      productId,
      file,
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.image.save", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId },
    });
    return { ok: false, error: "No pudimos guardar la foto. Intentá de nuevo." };
  }

  revalidatePath("/catalog");
  revalidatePath("/sales/new");

  // El `version` va en la URL de la imagen para saltear el caché del navegador.
  return { ok: true, version: Date.now() };
}

export async function deleteProductImage(productId: string): Promise<ProductImageResult> {
  const session = await requireAdminSession();

  try {
    await removeProductImage({ businessId: session.user.businessId, productId, userId: session.user.id });
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.image.remove", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId },
    });
    return { ok: false, error: "No pudimos quitar la foto. Intentá de nuevo." };
  }

  revalidatePath("/catalog");
  revalidatePath("/sales/new");

  return { ok: true, version: Date.now() };
}

export type AnalisisDeProductoResult =
  | {
      ok: true;
      analisis: {
        unidades: number;
        facturado: number;
        descuentos: number;
        costo: number;
        margen: number;
        margenPorcentaje: number | null;
        ventas: number;
        ultimaVenta: string | null;
        devueltas: number;
        devuelto: number;
        compradas: number;
        gastadoEnCompras: number;
        ultimoCosto: number | null;
        tiradas: number;
        perdidoEnMermas: number;
      };
    }
  | { ok: false; error: string };

/**
 * Los números de un producto para la pestaña de análisis.
 *
 * Se pide cuando se abre la pestaña y no al pintar el catálogo: son cuatro
 * consultas por producto y con sesenta productos serían doscientas cuarenta
 * para algo que casi nadie mira.
 *
 * `soldAt` sale como string ISO porque un Date no cruza el límite de la server
 * action sin serializarse.
 */
export async function getProductAnalytics(
  productId: string,
  periodo: string,
): Promise<AnalisisDeProductoResult> {
  const session = await requireAdminSession();

  try {
    const rango = rangoDelPeriodo(parsePeriodoDeAnalisis(periodo), new Date());
    const analisis = await analizarProductoEnPeriodo({
      businessId: session.user.businessId,
      productId,
      desde: rango.desde,
      hasta: rango.hasta,
    });

    return {
      ok: true,
      analisis: { ...analisis, ultimaVenta: analisis.ultimaVenta?.toISOString() ?? null },
    };
  } catch (error) {
    await logError("product.analytics", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId, periodo },
    });
    return { ok: false, error: "No pudimos calcular los números. Intentá de nuevo." };
  }
}

export type MovimientoDeFicha = {
  id: string;
  type: StockMovementType;
  /** Con signo, en milésimas. */
  quantity: number;
  reason: string | null;
  saleId: string | null;
  /** ISO: las fechas no cruzan el límite servidor→cliente como Date. */
  occurredAt: string;
  autor: string | null;
};

export type MovimientosDeFichaResult =
  | { ok: true; movimientos: MovimientoDeFicha[] }
  | { ok: false; error: string };

// Últimos movimientos de stock de un producto, para el historial de su ficha.
//
// La sucursal se valida contra el negocio de la sesión y no se cree la que
// manda el cliente: sin eso, cambiando un id en el navegador se leería el
// movimiento de stock de otro comercio.
export async function getProductStockMovements(
  productId: string,
  branchId: string,
): Promise<MovimientosDeFichaResult> {
  const session = await requireAdminSession();

  try {
    const sucursal = await findBranchForStock(branchId, session.user.businessId);
    if (!sucursal) {
      return { ok: false, error: "No encontramos esa sucursal." };
    }

    const movimientos = await findProductStockMovements({ branchId: sucursal.id, productId });

    return {
      ok: true,
      movimientos: movimientos.map((m) => ({ ...m, occurredAt: m.occurredAt.toISOString() })),
    };
  } catch (error) {
    logError("catalog.movimientos", error);
    return { ok: false, error: "No pudimos traer los movimientos." };
  }
}

export type SerieDeProductoResult =
  | { ok: true; serie: { dia: string; etiqueta: string; facturado: number }[] }
  | { ok: false; error: string };

// Facturación día por día del producto, para el gráfico de Rentabilidad.
//
// Los días se piden acá con `new Date()` y no se reciben del cliente: la
// ventana del gráfico la decide el servidor, no el navegador de quien mira.
export async function getProductDailySeries(productId: string, dias = 7): Promise<SerieDeProductoResult> {
  const session = await requireAdminSession();

  try {
    const acotado = Math.min(Math.max(Math.trunc(dias), 1), 31);
    const serie = await serieDiariaDeProducto({
      businessId: session.user.businessId,
      productId,
      hasta: new Date(),
      dias: acotado,
    });

    return { ok: true, serie };
  } catch (error) {
    logError("catalog.serie", error);
    return { ok: false, error: "No pudimos traer las ventas por día." };
  }
}

export type RendimientoResult =
  | {
      ok: true;
      rendimiento: {
        puesto: number | null;
        deCuantos: number;
        participacion: number | null;
        variacion: number | null;
        categoriaNombre: string | null;
      };
    }
  | { ok: false; error: string };

// Ranking, participación y comparación del producto para el período elegido.
//
// Va aparte del análisis y de la serie: son tres consultas comparativas que
// recorren las ventas de TODO el negocio, así que solo se pagan si el bloque
// está a la vista.
export async function getProductRendimiento(productId: string, periodo: string): Promise<RendimientoResult> {
  const session = await requireAdminSession();

  try {
    const rango = rangoDelPeriodo(parsePeriodoDeAnalisis(periodo), new Date());
    const rendimiento = await rendimientoDeProducto({
      businessId: session.user.businessId,
      productId,
      desde: rango.desde,
      hasta: rango.hasta,
    });

    return { ok: true, rendimiento };
  } catch (error) {
    logError("catalog.rendimiento", error);
    return { ok: false, error: "No pudimos comparar contra el resto." };
  }
}

export type CambioDeFicha = {
  id: string;
  field: ProductChangeField;
  previous: string | null;
  next: string | null;
  changedAt: string;
  autor: string | null;
};

export type HistorialResult = { ok: true; cambios: CambioDeFicha[] } | { ok: false; error: string };

// Historial de cambios del producto. El negocio sale de la sesión, nunca del
// cliente: el historial es de quién cambió qué, y no se lee el de otro comercio
// cambiando un id en el navegador.
export async function getProductHistory(productId: string): Promise<HistorialResult> {
  const session = await requireAdminSession();

  try {
    const cambios = await findProductChanges({ productId, businessId: session.user.businessId });

    return {
      ok: true,
      cambios: cambios.map((c) => ({ ...c, changedAt: c.changedAt.toISOString() })),
    };
  } catch (error) {
    logError("catalog.historial", error);
    return { ok: false, error: "No pudimos traer el historial." };
  }
}
