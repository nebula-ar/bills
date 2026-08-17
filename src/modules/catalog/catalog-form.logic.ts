import { ProductKind, Unit } from "@/generated/prisma/enums";
import { parseQuantityInput } from "@/lib/quantity";

/**
 * Cómo se interpreta lo que el dueño tipeó en la pantalla de Productos.
 *
 * Vivía adentro de `src/app/catalog/actions.ts`, que lleva `"use server"`: nada
 * de eso se podía importar desde un test, así que el único lugar donde se
 * decide un precio y una cantidad no tenía una sola prueba. Acá es lógica pura
 * —sin Prisma, sin sesión, sin `new Date()`— que es lo que pide AGENTS.md.
 *
 * Las reglas del proyecto que se defienden acá:
 * - La plata son enteros en pesos, sin centavos.
 * - El punto SIEMPRE separa miles, nunca decimales ("28.000" son veintiocho mil).
 * - Las cantidades se tipean en unidades y se guardan en milésimas.
 */

/**
 * Un monto entero en pesos. Devuelve null si no es un entero >= 0.
 *
 * Acepta el cero a propósito, al revés que `parsePrice`: un costo de cero es
 * raro pero posible (mercadería bonificada), mientras que un precio de cero
 * significa regalar el producto y casi siempre es un error de tipeo.
 */
export function parseWholeAmount(value: string): number | null {
  const amount = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(amount) && amount >= 0 ? amount : null;
}

/**
 * Un precio en pesos. Devuelve null si no es un entero > 0.
 *
 * El punto se saca antes de convertir porque acá separa miles: sin esto,
 * `Number("28.000")` da 28 y el producto sale a veintiocho pesos.
 */
export function parsePrice(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(/\./g, "").replace(",", ".");
  const price = Number(normalizedValue);

  return Number.isInteger(price) && price > 0 ? price : null;
}

/** Un campo obligatorio ya recortado. null = no vino, o vino vacío. */
export function parseRequiredString(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

/**
 * Un campo opcional ya recortado. `undefined` = no vino en el formulario.
 *
 * La diferencia entre `undefined` y `null` no es cosmética: `undefined` es "no
 * lo mandaron" —el campo está en otra pestaña, o el rubro no lo usa— y `null`
 * es "lo borraron". Confundirlos hace que guardar desde una pestaña borre en
 * silencio lo que estaba cargado en la otra.
 */
export function parseOptionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export type CommercialFields = {
  kind?: ProductKind;
  unit?: Unit;
  sku?: string | null;
  barcode?: string | null;
  cost?: number | null;
  trackStock?: boolean;
  minStock?: number | null;
  idealStock?: number | null;
  packSize?: number | null;
  packLabel?: string | null;
  categoryId?: string | null;
};

/**
 * Los campos comerciales de la ficha.
 *
 * Solo llegan cuando el rubro los usa. Si el formulario no los mandó se
 * devuelve un objeto vacío para que el caso de uso no los pise: con un
 * `{ sku: null, cost: null, ... }` cada guardado desde una pantalla que no
 * pregunta esas cosas las borraría todas.
 */
export function parseCommercialFields(formData: FormData): CommercialFields {
  if (formData.get("hasCommercialFields") !== "true") {
    return {};
  }

  const kindRaw = parseOptionalString(formData, "kind");
  const unitRaw = parseOptionalString(formData, "unit");
  const costRaw = parseOptionalString(formData, "cost");
  const minStockRaw = parseOptionalString(formData, "minStock");
  const idealStockRaw = parseOptionalString(formData, "idealStock");
  const packSizeRaw = parseOptionalString(formData, "packSize");
  const kind =
    kindRaw && (Object.values(ProductKind) as string[]).includes(kindRaw) ? (kindRaw as ProductKind) : undefined;

  return {
    kind,
    unit: unitRaw && (Object.values(Unit) as string[]).includes(unitRaw) ? (unitRaw as Unit) : undefined,
    sku: parseOptionalString(formData, "sku") ?? null,
    barcode: parseOptionalString(formData, "barcode") ?? null,
    cost: costRaw ? parseWholeAmount(costRaw) : null,
    // Se deduce del tipo en vez de preguntarse: un servicio no tiene existencias
    // y un producto físico sí, siempre. Preguntarlo aparte permitía guardar la
    // contradicción "servicio que descuenta stock".
    trackStock: kind === undefined ? undefined : kind !== ProductKind.SERVICE,
    // El mínimo se tipea en unidades y se guarda en milésimas, igual que el stock.
    minStock: minStockRaw ? parseQuantityInput(minStockRaw) : null,
    // El ideal, igual. Contesta otra pregunta que el mínimo: aquél dice cuándo
    // reponer, éste cuánto.
    idealStock: idealStockRaw ? parseQuantityInput(idealStockRaw) : null,
    // El bulto se cuenta en unidades enteras: media caja no existe.
    packSize: packSizeRaw ? parseWholeAmount(packSizeRaw) : null,
    packLabel: parseOptionalString(formData, "packLabel") ?? null,
    categoryId: parseOptionalString(formData, "categoryId") ?? null,
  };
}

/**
 * ¿Hay que crear o tocar la configuración de sucursal al guardar la ficha?
 *
 * Es la condición que decide si el producto queda vendible en esa sucursal.
 * Vale la pena tenerla afuera porque combina tres señales que llegan por
 * separado y el orden importa: alcanza con que el dueño haya tipeado un precio
 * para que cuente como intención, aunque no haya tocado el switch.
 */
export function quiereConfigurarSucursal(input: {
  configured: boolean;
  active: boolean;
  priceRaw: FormDataEntryValue | null;
}): boolean {
  const priceEntered = typeof input.priceRaw === "string" && input.priceRaw.trim().length > 0;
  return input.configured || input.active || priceEntered;
}
