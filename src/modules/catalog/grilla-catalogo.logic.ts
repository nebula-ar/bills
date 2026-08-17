import { parseAmountInput } from "@/lib/money";
import { QUANTITY_SCALE } from "@/lib/quantity";

/**
 * Los números que muestra la pantalla de Productos: el margen de una fila, el
 * estado de su existencia, los totales de arriba de la grilla y cuántos campos
 * de la ficha están sin guardar.
 *
 * Vivía adentro de `catalog-manager.tsx`, un componente de 2000 líneas con
 * Syncfusion adentro: para probar que el margen de un producto sin costo da "—"
 * había que montar la grilla entera. Acá es lógica pura y se prueba con una
 * llamada, que es lo que pide AGENTS.md para los `.logic.ts`.
 *
 * Los tipos son estructurales a propósito —piden solo los campos que usan— así
 * que `ProductRow` los satisface sin castear y sin que este módulo tenga que
 * conocer el componente.
 */

export type FilaConStock = {
  /** Existencia en milésimas. null = el producto no lleva control de stock. */
  stockQuantity: number | null;
  /** Mínimo en milésimas. null = no se cargó. */
  minStockRaw: number | null;
};

export type FilaConPlata = FilaConStock & {
  /** Costo de reposición en pesos enteros. null = sin cargar. */
  cost: number | null;
  /** Precio en la sucursal elegida. null = sin precio acá. */
  priceValue: number | null;
};

export type EstadoDeStock = "out" | "low" | "ok";

/**
 * El margen sobre el precio, en porcentaje entero.
 *
 * Sobre el PRECIO y no sobre el costo: es lo que se cobra de más por cada peso
 * que entra, que es la pregunta del dueño. Un producto que se compra a 100 y se
 * vende a 200 tiene 50% de margen acá, no 100%.
 */
export function margenPct(cost: number | null, price: number | null): number | null {
  if (cost === null || price === null || price <= 0) return null;
  return Math.round((1 - cost / price) * 100);
}

/**
 * En qué situación está la existencia de una fila.
 *
 * null = el producto no lleva stock (un corte de pelo no se queda sin
 * existencias), que es distinto de tener cero.
 */
export function stockStatusOf(product: FilaConStock): EstadoDeStock | null {
  if (product.stockQuantity === null) return null;
  if (product.stockQuantity <= 0) return "out";
  if (product.minStockRaw !== null && product.stockQuantity <= product.minStockRaw) return "low";
  return "ok";
}

export type TotalesDeGrilla = {
  productos: number;
  conStock: number;
  porReponer: number;
  /** Plata inmovilizada: Σ(costo × existencia). */
  costo: number;
  /** Lo que entraría si se vendiera todo: Σ(precio × existencia). */
  precio: number;
  margen: number | null;
  /** Cuántos quedaron afuera del costo por no tenerlo cargado. */
  sinCosto: number;
};

/**
 * Los totales que van arriba de la grilla.
 *
 * Se calculan sobre las filas que se le pasen —las visibles, o las filtradas si
 * hay un filtro puesto— y no sobre la página actual: un total que solo suma los
 * diez de la primera página no es un total, es una mentira con formato de
 * número.
 */
export function totalesDe(productos: FilaConPlata[]): TotalesDeGrilla {
  let conStock = 0;
  let porReponer = 0;
  let costo = 0;
  let precio = 0;
  let sinCosto = 0;

  for (const producto of productos) {
    const estado = stockStatusOf(producto);
    if (estado === "out" || estado === "low") porReponer += 1;

    const existencia = producto.stockQuantity;
    if (existencia === null || existencia <= 0) continue;
    conStock += 1;

    // La existencia viene en milésimas (ver lib/quantity.ts).
    const unidades = existencia / QUANTITY_SCALE;
    // Un producto sin costo no vale cero: no se sabe cuánto vale. Contarlo como
    // cero abarata el total y por lo tanto infla el margen, así que queda
    // afuera y se avisa cuántos son (mismo criterio que `unitCost` en AGENTS.md).
    if (producto.cost === null) sinCosto += 1;
    else costo += producto.cost * unidades;
    if (producto.priceValue !== null) precio += producto.priceValue * unidades;
  }

  return {
    productos: productos.length,
    conStock,
    porReponer,
    costo: Math.round(costo),
    precio: Math.round(precio),
    margen: precio > 0 && costo > 0 ? Math.round((1 - costo / precio) * 100) : null,
    sinCosto,
  };
}

export type FilaEditable = {
  name: string;
  description: string | null;
  cost: number | null;
  sku: string | null;
  barcode: string | null;
  minStockValue: string;
  idealStockValue: string;
};

export type ConfigDeSucursal = {
  available: boolean;
  /** Precio como texto, tal cual lo devuelve la página. */
  priceValue: string;
};

/**
 * Cuántos campos de la ficha difieren de lo que está guardado.
 *
 * Se compara valor contra valor y no "¿tocó una tecla?": escribir un 5 y
 * borrarlo deja el formulario igual que como estaba, y avisar "1 cambio sin
 * guardar" ahí es una alarma falsa. La plata se normaliza con el mismo parser
 * que usa el guardado, así que "$ 3.500" y "3500" cuentan como el mismo valor.
 */
export function contarCambios(
  datos: FormData,
  producto: FilaEditable,
  config: ConfigDeSucursal | null,
): number {
  const texto = (campo: string) => String(datos.get(campo) ?? "").trim();
  const plata = (campo: string) => parseAmountInput(texto(campo));

  const comparaciones: boolean[] = [
    texto("name") !== producto.name,
    plata("price") !== (config?.priceValue ? parseAmountInput(config.priceValue) : null),
    plata("cost") !== producto.cost,
    texto("sku") !== (producto.sku ?? ""),
    texto("barcode") !== (producto.barcode ?? ""),
    texto("minStock") !== producto.minStockValue,
    texto("idealStock") !== producto.idealStockValue,
    texto("description") !== (producto.description ?? "").trim(),
    // El switch de disponibilidad manda el campo `active` —no `available`— y
    // solo cuando está prendido: el input oculto directamente no se dibuja si
    // está apagado (ver SyncSwitch), así que "on" o ausente. Es el mismo par
    // que lee la action al guardar.
    (datos.get("active") === "on") !== (config?.available ?? false),
  ];

  return comparaciones.filter(Boolean).length;
}
