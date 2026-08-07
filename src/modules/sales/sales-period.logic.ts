/**
 * Períodos del historial de ventas.
 *
 * El corte es por DÍA CALENDARIO, no por "últimas 24 horas": el que abre esta
 * pantalla quiere saber cuánto hizo hoy, y a las 9 de la mañana un corte móvil
 * le mezclaría media jornada de ayer.
 *
 * El día "de hoy" se inyecta y no se lee del reloj acá adentro, para que los
 * tests no dependan de cuándo se corren.
 */

export const PERIODOS = ["hoy", "ayer", "semana", "mes"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const PERIODO_LABELS: Record<Periodo, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "7 días",
  mes: "Este mes",
};

/** Cae al período por defecto ante cualquier cosa rara en la URL. */
export function parsePeriodo(valor: string | undefined): Periodo {
  return PERIODOS.includes(valor as Periodo) ? (valor as Periodo) : "hoy";
}

function inicioDelDia(fecha: Date) {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

/**
 * Desde inclusive, hasta EXCLUSIVE.
 *
 * El límite superior exclusivo evita el clásico agujero de un milisegundo: con
 * `23:59:59.999` se pierde la venta que cae justo en el último milisegundo del
 * día, que es rarísimo pero cuando pasa nadie lo encuentra.
 */
export function rangoDelPeriodo(periodo: Periodo, hoy: Date): { desde: Date; hasta: Date } {
  const arranqueDeHoy = inicioDelDia(hoy);
  const manana = new Date(arranqueDeHoy);
  manana.setDate(manana.getDate() + 1);

  if (periodo === "hoy") return { desde: arranqueDeHoy, hasta: manana };

  if (periodo === "ayer") {
    const ayer = new Date(arranqueDeHoy);
    ayer.setDate(ayer.getDate() - 1);
    return { desde: ayer, hasta: arranqueDeHoy };
  }

  if (periodo === "semana") {
    // Siete días CONTANDO hoy: "7 días" para el que atiende incluye el de hoy,
    // no son los siete anteriores más el actual.
    const desde = new Date(arranqueDeHoy);
    desde.setDate(desde.getDate() - 6);
    return { desde, hasta: manana };
  }

  const primeroDelMes = new Date(arranqueDeHoy);
  primeroDelMes.setDate(1);
  return { desde: primeroDelMes, hasta: manana };
}
