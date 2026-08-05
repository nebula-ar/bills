import { ProductKind, Unit } from "@/generated/prisma/enums";

/**
 * Conversión del catálogo de Migas (la app de panadería que se absorbe) al
 * modelo de Bills.
 *
 * Las diferencias son de FORMATO, no de concepto, y son dos:
 *
 *  1. Migas guarda la plata en `Decimal`; Bills en enteros de PESOS, sin
 *     centavos (ver src/lib/money.ts). Se verificó contra la base de Migas que
 *     ningún registro usa centavos, así que no se pierde nada — pero el test
 *     lo vuelve a comprobar sobre el catálogo real en cada corrida, porque el
 *     día que alguien cargue $1250,50 esto deja de ser cierto.
 *  2. En Migas el precio vive en el producto; en Bills vive por sucursal
 *     (`BranchProductPrice`), porque el mismo producto puede valer distinto en
 *     cada local. Por eso la conversión devuelve el precio aparte.
 *
 * Lo que NO se porta y por qué está en el test.
 */

/** Un producto tal como sale de la base de Migas. */
export type ProductoMigas = {
  nombre: string;
  sku: string | null;
  precio: number;
  costo: number | null;
  unidad: string;
  emoji: string;
  minutos: number | null;
  activo: boolean;
  categoria: string | null;
};

/** Lo que Bills necesita para dar de alta el producto, sin el precio. */
export type ProductoBills = {
  name: string;
  sku: string | null;
  cost: number | null;
  unit: Unit;
  kind: ProductKind;
  trackStock: boolean;
};

export type Conversion = {
  product: ProductoBills;
  /** Va a `BranchProductPrice`, una fila por sucursal. */
  price: number;
  activo: boolean;
  categoria: string | null;
};

/**
 * Unidad de Migas (texto libre) a la de Bills (enum).
 *
 * Lanza ante una unidad desconocida en vez de caer en el default. Un producto
 * que pasa a venderse "por unidad" sin que nadie lo note es el tipo de error
 * que se descubre seis meses después, cuando el stock ya no cierra.
 */
export function unidadDesdeMigas(unidad: string): Unit {
  const encontrada = Object.values(Unit).find((u) => u === unidad.trim().toUpperCase());

  if (!encontrada) {
    throw new Error(`Unidad de Migas sin equivalente en Bills: "${unidad}"`);
  }

  return encontrada;
}

export function productoDesdeMigas(item: ProductoMigas): Conversion {
  return {
    product: {
      name: item.nombre,
      sku: item.sku,
      cost: item.costo,
      unit: unidadDesdeMigas(item.unidad),
      // El default de Bills es SERVICE porque nació en una barbería. Una
      // medialuna que entra como servicio no descuenta stock ni tiene costo de
      // reposición, y el margen queda mal calculado en silencio.
      kind: ProductKind.GOOD,
      // Migas ya lleva inventario: entrar sin esto sería perder esa mitad.
      trackStock: true,
    },
    price: item.precio,
    activo: item.activo,
    categoria: item.categoria,
  };
}
