import { QUANTITY_SCALE } from "@/lib/quantity";

/**
 * Los números de un producto en un período.
 *
 * Todo lo que se muestra sale de lo que YA pasó, congelado en el renglón de la
 * venta: el `unitCost` que se guardó al vender, no el costo de hoy. Si usáramos
 * el costo actual, subir el precio de compra cambiaría el margen de las ventas
 * del mes pasado, que es una historia que no ocurrió.
 *
 * Las cantidades entran en milésimas (ver src/lib/quantity.ts) y salen igual;
 * la pantalla las formatea.
 */

export type RenglonVendido = {
  saleId: string;
  quantity: number;
  /** Ya neto del descuento prorrateado de la promo. */
  total: number;
  discount: number;
  unitCost: number | null;
  soldAt: Date;
  /** Cuánto de este renglón se devolvió después (milésimas y pesos). */
  devuelto: { quantity: number; amount: number };
};

export type RenglonComprado = { quantity: number; unitCost: number; at: Date };
export type RenglonTirado = { quantity: number };

export type AnalisisDeProducto = {
  unidades: number;
  facturado: number;
  descuentos: number;
  costo: number;
  margen: number;
  /** Porcentaje entero sobre lo facturado. null si no se vendió nada. */
  margenPorcentaje: number | null;
  /** En cuántas ventas distintas apareció. */
  ventas: number;
  ultimaVenta: Date | null;
  devueltas: number;
  devuelto: number;
  compradas: number;
  gastadoEnCompras: number;
  ultimoCosto: number | null;
  tiradas: number;
  perdidoEnMermas: number;
};

const porMil = (cantidad: number, unitario: number) => Math.round((cantidad * unitario) / QUANTITY_SCALE);

export function analizarProducto(input: {
  vendidos: RenglonVendido[];
  comprados: RenglonComprado[];
  tirados: RenglonTirado[];
  /** Costo actual del producto, para valorizar lo que se tiró. */
  costoActual: number | null;
}): AnalisisDeProducto {
  const { vendidos, comprados, tirados, costoActual } = input;

  // Lo devuelto se resta en todos lados. Un producto que se vendió veinte veces
  // y se devolvió quince no vendió veinte: contarlo entero infla las unidades,
  // el facturado y el margen a la vez.
  const unidades = vendidos.reduce((suma, r) => suma + r.quantity - r.devuelto.quantity, 0);
  const facturado = vendidos.reduce((suma, r) => suma + r.total - r.devuelto.amount, 0);
  const costo = vendidos.reduce(
    (suma, r) => suma + porMil(r.quantity - r.devuelto.quantity, r.unitCost ?? 0),
    0,
  );
  const margen = facturado - costo;

  const gastadoEnCompras = comprados.reduce((suma, r) => suma + porMil(r.quantity, r.unitCost), 0);
  const tiradas = tirados.reduce((suma, r) => suma + r.quantity, 0);

  return {
    unidades,
    facturado,
    descuentos: vendidos.reduce((suma, r) => suma + r.discount, 0),
    costo,
    margen,
    // Sobre lo facturado y no sobre el costo: es el margen que se mira en el
    // mostrador ("de cada 100 pesos que entran, cuántos quedan"). Sin ventas es
    // null y no 0: no es que el margen sea cero, es que no hay con qué medirlo.
    margenPorcentaje: facturado === 0 ? null : Math.round((margen / facturado) * 100),
    ventas: new Set(vendidos.filter((r) => r.quantity > r.devuelto.quantity).map((r) => r.saleId)).size,
    ultimaVenta: vendidos.reduce<Date | null>(
      (ultima, r) => (ultima === null || r.soldAt > ultima ? r.soldAt : ultima),
      null,
    ),
    devueltas: vendidos.reduce((suma, r) => suma + r.devuelto.quantity, 0),
    devuelto: vendidos.reduce((suma, r) => suma + r.devuelto.amount, 0),
    compradas: comprados.reduce((suma, r) => suma + r.quantity, 0),
    gastadoEnCompras,
    // El último costo pagado, que es con el que conviene comparar el precio.
    ultimoCosto:
      comprados.length === 0
        ? null
        : comprados.reduce((ultimo, r) => (r.at > ultimo.at ? r : ultimo), comprados[0]).unitCost,
    tiradas,
    perdidoEnMermas: porMil(tiradas, costoActual ?? 0),
  };
}
