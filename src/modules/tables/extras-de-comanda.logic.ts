import { lineTotal } from "@/lib/quantity";

/**
 * Cuánta plata agregan las opciones elegidas en una comanda.
 *
 * Existe porque hoy esa plata se pierde: al cobrar una mesa, el POS precarga los
 * ítems y los precia con el precio de LISTA, así que el "Extra queso +$500" que
 * el mozo cargó y el cliente vio en la mesa no se cobra. El carrito del POS es
 * un `Record<productId, cantidad>` y no tiene dónde guardar una opción ni un
 * precio por renglón, así que arreglarlo de raíz es cambiarle la estructura.
 *
 * Mientras tanto esto permite decirlo en pantalla: cuánto falta y por qué. Un
 * número que no se cobra pero se ve es un problema; uno que no se cobra y no se
 * ve es plata que se va sin que nadie se entere.
 *
 * El delta es POR UNIDAD, igual que el precio: dos cafés con extra crema de $500
 * son $1.000. Y se redondea con `lineTotal`, el mismo redondeo que usa el precio
 * de la línea, para que el aviso no difiera del total por un peso.
 */

export type OpcionElegida = { name: string; priceDelta: number };

export type RenglonConOpciones = {
  productId: string;
  /** Cantidad en milésimas (ver src/lib/quantity.ts). */
  quantity: number;
  opciones: OpcionElegida[];
};

export type ExtrasDeComanda = {
  /** Suma de todos los ajustes, en pesos enteros. Puede ser negativo. */
  total: number;
  /** Cuánto aporta cada opción, juntando las repetidas. */
  detalle: { name: string; amount: number }[];
};

export function extrasDeComanda(renglones: RenglonConOpciones[]): ExtrasDeComanda {
  const porNombre = new Map<string, number>();

  for (const renglon of renglones) {
    for (const opcion of renglon.opciones) {
      // Un ajuste de cero no es plata: listarlo en un aviso sobre dinero hace
      // dudar de si cobra algo. "Bien caliente" no va acá.
      if (opcion.priceDelta === 0) continue;

      const monto = lineTotal(opcion.priceDelta, renglon.quantity);
      porNombre.set(opcion.name, (porNombre.get(opcion.name) ?? 0) + monto);
    }
  }

  const detalle = Array.from(porNombre.entries())
    .map(([name, amount]) => ({ name, amount }))
    .filter((linea) => linea.amount !== 0);

  return {
    total: detalle.reduce((suma, linea) => suma + linea.amount, 0),
    detalle,
  };
}
