/**
 * Serie de ventas día por día, para el gráfico de la ficha del producto.
 *
 * Es lógica pura: el "hoy" y el rango entran por parámetro, nunca se leen del
 * reloj acá dentro (ver AGENTS.md). Así el test puede fijar una semana y no
 * depende de cuándo se corra.
 */

export type VentaDelDia = { at: Date; facturado: number };

export type DiaDeLaSerie = {
  /** Clave estable YYYY-MM-DD, en hora local. */
  dia: string;
  /** Etiqueta corta para el eje: "Vie 09". */
  etiqueta: string;
  facturado: number;
};

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** YYYY-MM-DD en hora LOCAL, no UTC: con `toISOString` una venta de las 22 h
 *  argentinas cae en el día siguiente y el gráfico la corre de columna. */
export function claveDelDia(fecha: Date) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function etiquetaDelDia(fecha: Date) {
  return `${DIAS_CORTOS[fecha.getDay()]} ${String(fecha.getDate()).padStart(2, "0")}`;
}

/**
 * Arma la serie de los últimos `dias` días terminando en `hasta` (incluido).
 *
 * Los días SIN ventas entran igual, en cero. Es la diferencia entre un gráfico
 * que se lee y uno que engaña: si solo se dibujan los días con ventas, tres
 * ventas salteadas en dos semanas parecen tres días seguidos de actividad.
 */
export function serieDiaria(input: { ventas: VentaDelDia[]; hasta: Date; dias: number }): DiaDeLaSerie[] {
  const { ventas, hasta, dias } = input;

  const porDia = new Map<string, number>();
  for (const venta of ventas) {
    const clave = claveDelDia(venta.at);
    porDia.set(clave, (porDia.get(clave) ?? 0) + venta.facturado);
  }

  const serie: DiaDeLaSerie[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date(hasta);
    fecha.setDate(hasta.getDate() - i);
    const clave = claveDelDia(fecha);
    serie.push({ dia: clave, etiqueta: etiquetaDelDia(fecha), facturado: porDia.get(clave) ?? 0 });
  }

  return serie;
}

/**
 * El tope de la escala del gráfico. Con todo en cero devuelve null: dibujar
 * barras contra un máximo de cero da divisiones por cero, y además no hay nada
 * que comparar.
 */
export function topeDeLaSerie(serie: DiaDeLaSerie[]) {
  const maximo = serie.reduce((tope, dia) => Math.max(tope, dia.facturado), 0);
  return maximo > 0 ? maximo : null;
}
