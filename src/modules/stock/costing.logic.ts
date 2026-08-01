import { lineTotal } from "@/lib/quantity";

// Costo promedio ponderado (PPP), que es como se valúa el inventario de un
// comercio chico.
//
// Antes se valuaba a "último costo": todo el stock pasaba a valer lo que se
// pagó en la última compra. Con inflación eso miente por los dos lados. Si
// tenías 100 unidades a $1.000 y comprás 10 a $1.500:
//
//   último costo → 110 × $1.500 = $165.000, cuando pagaste $115.000
//   PPP          → 110 × $1.045 = $115.000  ✓
//
// Y al vender las viejas, "último costo" las costea a $1.500: el costo de lo
// vendido queda inflado y la ganancia parece menor de lo que fue.
//
// El promedio SOLO se mueve cuando entra mercadería. Las salidas (venta, merma,
// traspaso) sacan unidades al promedio vigente y no lo alteran — esa es
// justamente la propiedad que hace que el método cierre.

export type AverageCostInput = {
  // Cantidad que había, en milésimas. Puede ser negativa si se vendió sin stock.
  currentQuantity: number;
  // Promedio vigente. null cuando nunca entró nada con costo.
  currentAvgCost: number | null;
  // Cantidad que entra, en milésimas. Siempre positiva.
  incomingQuantity: number;
  // Costo unitario de lo que entra. null = no lo sabemos.
  incomingUnitCost: number | null;
};

// Promedio después de una entrada. Devuelve null solo si no hay ningún costo
// conocido: inventarse uno sería peor que admitir que no está.
export function averageCostAfterEntry(input: AverageCostInput): number | null {
  if (input.incomingUnitCost === null) {
    // Entró mercadería sin costo. El promedio de lo que ya había sigue siendo
    // la mejor estimación que tenemos; no se toca.
    return input.currentAvgCost;
  }

  if (input.currentAvgCost === null) {
    return input.incomingUnitCost;
  }

  // Con existencia en cero o negativa (se vendió sin stock) no hay nada que
  // promediar: el costo pasa a ser el de lo que acaba de entrar.
  if (input.currentQuantity <= 0) {
    return input.incomingUnitCost;
  }

  const currentValue = lineTotal(input.currentAvgCost, input.currentQuantity);
  const incomingValue = lineTotal(input.incomingUnitCost, input.incomingQuantity);
  const totalQuantity = input.currentQuantity + input.incomingQuantity;

  if (totalQuantity <= 0) {
    return input.incomingUnitCost;
  }

  // De vuelta a "pesos por unidad de medida": el valor está en pesos y la
  // cantidad en milésimas.
  return Math.round(((currentValue + incomingValue) * 1000) / totalQuantity);
}

// Promedio después de deshacer una entrada (anular una compra). Se saca del
// promedio exactamente el valor que esa compra había metido.
//
// Si al sacarla no queda nada, o la cuenta da un absurdo (puede pasar si entre
// medio hubo ajustes manuales), se deja el promedio como estaba: un número
// viejo es mejor que uno negativo.
export function averageCostAfterReversal(input: {
  currentQuantity: number;
  currentAvgCost: number | null;
  removedQuantity: number;
  removedUnitCost: number | null;
}): number | null {
  if (input.currentAvgCost === null || input.removedUnitCost === null) {
    return input.currentAvgCost;
  }

  const remainingQuantity = input.currentQuantity - input.removedQuantity;

  if (remainingQuantity <= 0) {
    return input.currentAvgCost;
  }

  const remainingValue =
    lineTotal(input.currentAvgCost, input.currentQuantity) - lineTotal(input.removedUnitCost, input.removedQuantity);

  if (remainingValue <= 0) {
    return input.currentAvgCost;
  }

  return Math.round((remainingValue * 1000) / remainingQuantity);
}

// Los movimientos que hacen entrar mercadería y por lo tanto recalculan el
// promedio. Una devolución de cliente repone al costo con el que salió, así que
// también entra acá.
export const ENTRY_MOVEMENTS = ["INITIAL", "PURCHASE", "TRANSFER_IN", "RETURN", "SALE_CANCELLED"] as const;

export function isEntryMovement(type: string, quantity: number): boolean {
  if (quantity <= 0) {
    return false;
  }
  // Un ajuste por conteo que suma también es mercadería que aparece: se valúa
  // al promedio vigente si lo hay, y si no, al costo que venga.
  return (ENTRY_MOVEMENTS as readonly string[]).includes(type) || type === "ADJUSTMENT";
}
