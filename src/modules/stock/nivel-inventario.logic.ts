import { QUANTITY_SCALE } from "@/lib/quantity";

/**
 * Nivel de inventario de un producto: dónde está la existencia entre el mínimo
 * y el ideal, para dibujar el medidor de la ficha.
 *
 * Todas las cantidades entran y salen en milésimas (ver src/lib/quantity.ts).
 *
 * Es lógica pura a propósito: la decisión de si algo "está por acabarse" no
 * puede vivir en el JSX, porque es la misma que usa el badge de la grilla y la
 * que va a usar cualquier aviso de reposición. Si se calcula en dos lados,
 * tarde o temprano un lado dice "reponer" y el otro no.
 */

export type EstadoDeNivel = "sin-datos" | "sin-stock" | "bajo" | "ok" | "excedido";

export type NivelDeInventario = {
  estado: EstadoDeNivel;
  /** Posición del actual sobre la escala, 0 a 1. null cuando no hay escala. */
  posicion: number | null;
  /** Tope de la escala en milésimas. null cuando no hay con qué armarla. */
  tope: number | null;
  /** Cuánto falta para llegar al ideal, en milésimas. null si no hay ideal. */
  faltaParaIdeal: number | null;
};

/**
 * El tope de la escala no es el ideal: si lo fuera, un producto con más stock
 * que el ideal se saldría del medidor o quedaría clavado en el extremo, sin
 * poder distinguir "justo en el ideal" de "tengo el triple". Se estira al
 * mayor entre el ideal y la existencia, con un 15% de aire para que la marca
 * no quede pegada al borde.
 */
const AIRE = 1.15;

export function nivelDeInventario(input: {
  actual: number | null;
  minimo: number | null;
  ideal: number | null;
}): NivelDeInventario {
  const { actual, minimo, ideal } = input;

  // Sin existencia conocida no hay nada que ubicar. Distinto de cero: cero es
  // "se acabó", null es "este producto no lleva control de stock".
  if (actual === null) {
    return { estado: "sin-datos", posicion: null, tope: null, faltaParaIdeal: null };
  }

  const referencia = ideal ?? (minimo !== null ? minimo * 2 : null);
  const tope = referencia === null ? null : Math.max(referencia, actual) * AIRE;

  const estado: EstadoDeNivel =
    actual <= 0
      ? "sin-stock"
      : minimo !== null && actual <= minimo
        ? "bajo"
        : ideal !== null && actual > ideal
          ? "excedido"
          : "ok";

  return {
    estado,
    posicion: tope === null || tope <= 0 ? null : Math.min(1, actual / tope),
    tope,
    faltaParaIdeal: ideal === null ? null : Math.max(0, ideal - actual),
  };
}

/** Dónde cae una marca (mínimo, ideal) sobre la escala, 0 a 1. */
export function marcaEnEscala(valor: number | null, tope: number | null) {
  if (valor === null || tope === null || tope <= 0) return null;
  return Math.min(1, valor / tope);
}

/** Milésimas a unidades enteras, para los textos del medidor. */
export function enUnidades(milesimas: number) {
  return milesimas / QUANTITY_SCALE;
}
