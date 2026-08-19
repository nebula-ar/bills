import type { Unit } from "@/generated/prisma/enums";
import { allowsFraction, parseQuantityInput } from "@/lib/quantity";

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

/**
 * ¿El teclado tiene que ofrecer la coma para esta unidad?
 *
 * De acá sale el `inputMode` del campo de cantidad. Ofrecer un teclado decimal
 * donde el parser rechaza los decimales es invitar a tipear algo que se pierde:
 * `parseQuantityInput` devuelve `null` para "2,5" docenas y la cantidad se cae
 * sin que nada falle a la vista.
 */
export function admiteComa(unit: Unit): boolean {
  return allowsFraction(unit);
}

/**
 * Por qué no se puede usar lo que el usuario escribió. `null` = está bien.
 *
 * El mensaje tiene que decir el problema REAL. Antes, una coma en una unidad
 * que no se fracciona caía en "tiene que ser un número mayor que cero", que es
 * mentira —2,5 es mayor que cero— así que el usuario corregía el signo, que
 * estaba bien, y volvía a fallar sin entender por qué.
 *
 * El campo vacío no es un problema: todavía no escribió nada, y un error rojo
 * ahí regaña por no haber empezado.
 */
export function problemaDeCantidad(input: {
  escrito: string;
  unit: Unit;
  /** Un conteo acepta el cero ("se acabó"); recibir o perder cero, no. */
  esConteo?: boolean;
}): string | null {
  const escrito = input.escrito.trim();

  if (escrito === "") return null;

  const cantidad = parseQuantityInput(escrito, input.unit);
  if (cantidad !== null) return null;

  // Contar cero es legítimo y el parser igual devuelve null, así que se
  // contempla antes de decidir que hay un problema.
  if (input.esConteo && escrito === "0") return null;

  // Una fracción de verdad —dígitos a los dos lados del separador— en una
  // unidad que no la admite. "1," no entra acá: es un número a medio escribir,
  // y mandarlo a "se cuenta de a uno" lo haría corregir lo que no está mal.
  const fraccion = /^\d+[.,]\d+$/.test(escrito);
  if (fraccion && !allowsFraction(input.unit)) {
    return `${escrito} no se puede: se cuenta de a uno.`;
  }

  return input.esConteo ? "Escribí cuánto contaste." : "Tiene que ser un número mayor que cero.";
}
