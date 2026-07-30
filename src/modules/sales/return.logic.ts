import { lineTotal } from "@/lib/quantity";

// Lógica pura de devoluciones. Lo delicado acá es el dinero: cuánto se le
// devuelve al cliente por cada renglón cuando la venta tuvo descuentos.
//
// Regla: se devuelve lo que el cliente PAGÓ por ese renglón, proporcional a la
// cantidad que trae. Si compró 3 alfajores con 3x2 (pagó 2) y devuelve 1, se le
// devuelve un tercio de lo que pagó, no el precio de lista. Devolver el precio
// de lista sería regalarle plata: se llevaría más de lo que puso.

export type ReturnableItem = {
  saleItemId: string;
  description: string;
  // Cantidad vendida y cantidad ya devuelta en devoluciones anteriores.
  soldQuantity: number;
  returnedQuantity: number;
  unitPrice: number;
  // Descuento por promociones imputado a este renglón.
  discount: number;
};

export type ReturnLine = {
  saleItemId: string;
  quantity: number;
};

export type PricedReturnLine = ReturnLine & { amount: number };

export type ReturnQuote = {
  lines: PricedReturnLine[];
  total: number;
};

export const ReturnErrorCode = {
  NOTHING_TO_RETURN: "NOTHING_TO_RETURN",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  EXCEEDS_SOLD: "EXCEEDS_SOLD",
  UNKNOWN_ITEM: "UNKNOWN_ITEM",
} as const;

export type ReturnErrorCode = (typeof ReturnErrorCode)[keyof typeof ReturnErrorCode];

export class ReturnError extends Error {
  constructor(
    public readonly code: ReturnErrorCode,
    public readonly detail?: { description?: string; available?: number },
  ) {
    super(code);
    this.name = "ReturnError";
  }
}

// Lo que todavía se puede devolver de un renglón.
export function pendingQuantity(item: ReturnableItem): number {
  return Math.max(item.soldQuantity - item.returnedQuantity, 0);
}

// Lo que el cliente pagó por el renglón entero, ya con el descuento aplicado.
export function paidForItem(item: ReturnableItem): number {
  return Math.max(lineTotal(item.unitPrice, item.soldQuantity) - item.discount, 0);
}

// Cotiza la devolución: valida cantidades y calcula cuánta plata sale.
export function quoteReturn(items: ReturnableItem[], lines: ReturnLine[]): ReturnQuote {
  const byId = new Map(items.map((item) => [item.saleItemId, item]));
  const priced: PricedReturnLine[] = [];

  for (const line of lines) {
    if (line.quantity <= 0) {
      continue;
    }

    const item = byId.get(line.saleItemId);

    if (!item) {
      throw new ReturnError(ReturnErrorCode.UNKNOWN_ITEM);
    }

    if (!Number.isInteger(line.quantity)) {
      throw new ReturnError(ReturnErrorCode.INVALID_QUANTITY, { description: item.description });
    }

    const pending = pendingQuantity(item);

    if (line.quantity > pending) {
      throw new ReturnError(ReturnErrorCode.EXCEEDS_SOLD, {
        description: item.description,
        available: pending,
      });
    }

    const paid = paidForItem(item);

    // Proporcional a la cantidad devuelta. Si devuelve todo lo que queda y no
    // hubo devoluciones previas, se le devuelve exactamente lo que pagó (sin
    // arrastrar el error del redondeo).
    const amount =
      line.quantity === item.soldQuantity && item.returnedQuantity === 0
        ? paid
        : Math.round((paid * line.quantity) / item.soldQuantity);

    priced.push({ saleItemId: line.saleItemId, quantity: line.quantity, amount });
  }

  if (priced.length === 0) {
    throw new ReturnError(ReturnErrorCode.NOTHING_TO_RETURN);
  }

  return {
    lines: priced,
    total: priced.reduce((sum, line) => sum + line.amount, 0),
  };
}
