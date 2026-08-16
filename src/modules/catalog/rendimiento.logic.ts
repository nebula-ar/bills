/**
 * Cómo le fue a un producto CONTRA el resto y contra su propio pasado.
 *
 * Las cuatro tarjetas de Rentabilidad dicen cuánto vendió. Esto contesta lo que
 * viene después: ¿mucho o poco? Un producto que facturó $200.000 puede ser el
 * que sostiene el mostrador o el que apenas asoma, y el número solo no lo dice.
 *
 * Lógica pura y con el "ahora" afuera (ver AGENTS.md): acá entran totales ya
 * calculados, no consultas.
 */

export type VentaPorProducto = {
  productId: string;
  /** Facturado en el período, en pesos enteros. */
  facturado: number;
  /** null = el producto no tiene categoría. */
  categoryId: string | null;
};

export type Rendimiento = {
  /** Puesto dentro de su categoría, empezando en 1. null si no vendió nada. */
  puesto: number | null;
  /** Cuántos compiten en esa categoría (los que vendieron algo). */
  deCuantos: number;
  /** Qué porción de lo facturado por el negocio explica. null si no hubo ventas. */
  participacion: number | null;
  /** Variación contra el período anterior, en %. null cuando no se puede comparar. */
  variacion: number | null;
};

/**
 * El puesto se calcula solo entre los que VENDIERON. Incluir los que no
 * vendieron nada inflaría el denominador —"#3 de 128"— con productos que no
 * compitieron: en un catálogo grande, casi cualquiera parecería estar arriba.
 */
export function calcularRendimiento(input: {
  productId: string;
  categoryId: string | null;
  ventas: VentaPorProducto[];
  facturadoPeriodoAnterior: number;
}): Rendimiento {
  const { productId, categoryId, ventas, facturadoPeriodoAnterior } = input;

  const conVentas = ventas.filter((v) => v.facturado > 0);
  const propio = conVentas.find((v) => v.productId === productId) ?? null;
  const facturadoPropio = propio?.facturado ?? 0;

  const enLaCategoria = conVentas
    .filter((v) => v.categoryId === categoryId)
    .sort((a, b) => b.facturado - a.facturado);

  const indice = enLaCategoria.findIndex((v) => v.productId === productId);
  const totalDelNegocio = conVentas.reduce((suma, v) => suma + v.facturado, 0);

  return {
    puesto: indice >= 0 ? indice + 1 : null,
    deCuantos: enLaCategoria.length,
    participacion:
      totalDelNegocio > 0 && facturadoPropio > 0
        ? Math.round((facturadoPropio / totalDelNegocio) * 1000) / 10
        : null,
    variacion: calcularVariacion(facturadoPropio, facturadoPeriodoAnterior),
  };
}

/**
 * Variación porcentual contra el período anterior.
 *
 * Devuelve null cuando antes no hubo NADA: pasar de 0 a $500.000 no es "+100%"
 * ni "+∞", es un producto que empezó a venderse. Poner un porcentaje ahí es
 * inventar una base que no existe, y encima queda igual que un producto que
 * duplicó — que es una situación completamente distinta.
 */
export function calcularVariacion(ahora: number, antes: number): number | null {
  if (antes <= 0) return null;
  return Math.round(((ahora - antes) / antes) * 100);
}
