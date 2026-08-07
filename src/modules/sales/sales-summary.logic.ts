import { SaleStatus } from "@/generated/prisma/enums";

/**
 * Totales del historial de ventas.
 *
 * Una lista de ventas contesta "qué vendí"; estos números contestan "cómo me
 * fue", que es lo que se mira primero al abrir la pantalla.
 */

export type VentaParaTotalizar = {
  total: number;
  status: SaleStatus;
  payments: { method: string; amount: number }[];
};

export type Totales = {
  cantidad: number;
  facturado: number;
  ticketPromedio: number;
  /** Cuánto entró por cada medio, de mayor a menor. */
  porMedio: { metodo: string; monto: number }[];
  canceladas: number;
};

/**
 * Resumen del período, con el filtro por medio de pago ya aplicado.
 *
 * Los medios disponibles salen del período SIN filtrar. Si salieran de lo
 * filtrado, al elegir "Efectivo" desaparecerían los demás chips y no habría
 * forma de cambiar de filtro sin volver atrás: un filtro que se borra a sí
 * mismo deja al usuario encerrado.
 */
export function resumenDelPeriodo(
  ventas: VentaParaTotalizar[],
  metodo?: string,
): { totales: Totales; metodosDisponibles: string[] } {
  const vigentes = ventas.filter((venta) => venta.status !== SaleStatus.CANCELLED);
  const metodosDisponibles = [...new Set(vigentes.flatMap((v) => v.payments.map((p) => p.method)))].sort();

  return {
    // Una venta con pago dividido aparece en los DOS medios: se pagó con los
    // dos, y esconderla de uno haría que el filtro mienta.
    totales: totalizar(metodo ? ventas.filter((v) => v.payments.some((p) => p.method === metodo)) : ventas),
    metodosDisponibles,
  };
}

export function totalizar(ventas: VentaParaTotalizar[]): Totales {
  // Las canceladas se cuentan aparte y NO suman: si sumaran, la caja del día
  // cerraría con plata que nadie tiene.
  const vigentes = ventas.filter((venta) => venta.status !== SaleStatus.CANCELLED);
  const facturado = vigentes.reduce((suma, venta) => suma + venta.total, 0);

  const porMetodo = new Map<string, number>();
  for (const venta of vigentes) {
    for (const pago of venta.payments) {
      porMetodo.set(pago.method, (porMetodo.get(pago.method) ?? 0) + pago.amount);
    }
  }

  return {
    cantidad: vigentes.length,
    facturado,
    // Entero: son pesos sin centavos (ver src/lib/money.ts). Un promedio con
    // decimales acá sería precisión inventada.
    ticketPromedio: vigentes.length === 0 ? 0 : Math.round(facturado / vigentes.length),
    porMedio: [...porMetodo.entries()]
      .map(([metodo, monto]) => ({ metodo, monto }))
      // De mayor a menor: lo que interesa es por dónde entra la plata, y el
      // desempate por nombre hace que el orden no baile entre renders.
      .sort((a, b) => b.monto - a.monto || a.metodo.localeCompare(b.metodo, "es")),
    canceladas: ventas.length - vigentes.length,
  };
}
