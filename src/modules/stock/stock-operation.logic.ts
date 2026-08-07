/**
 * Qué le pasa a la existencia según lo que se toque.
 *
 * Existe porque las tres operaciones NO son lo mismo y la pantalla no lo decía:
 * "Conté" fija la existencia en el número escrito, "Llegó" y "Se perdió" suman
 * y restan. Escribir 9 en una deja 9; escribir 9 en otra deja 2. La única forma
 * de que eso no se preste a confusión es mostrar en qué va a quedar ANTES de
 * confirmar, y para eso hay que calcularlo.
 *
 * Todo en milésimas (ver src/lib/quantity.ts).
 */

export type OperacionDeStock = "adjust" | "receive" | "loss";

export type ResultadoDeOperacion = {
  /** En cuánto queda la existencia. Nunca negativa. */
  queda: number;
  /** Cuánto se mueve respecto de lo que había: positivo entra, negativo sale. */
  cambio: number;
  /**
   * Si el número escrito no se puede aplicar entero. Pasa al perder más de lo
   * que hay: la existencia toca cero y el resto no tiene de dónde salir.
   */
  recortado: boolean;
};

export function resultadoDeOperacion(
  operacion: OperacionDeStock,
  actual: number,
  cantidad: number,
): ResultadoDeOperacion {
  if (operacion === "adjust") {
    // Lo contado manda: el número escrito ES la existencia nueva.
    const queda = Math.max(0, cantidad);
    return { queda, cambio: queda - actual, recortado: cantidad < 0 };
  }

  if (operacion === "receive") {
    return { queda: actual + cantidad, cambio: cantidad, recortado: false };
  }

  // Perder más de lo que hay deja la existencia en cero, no en negativo: no se
  // pueden romper doce si había once.
  const queda = Math.max(0, actual - cantidad);
  return { queda, cambio: queda - actual, recortado: cantidad > actual };
}
