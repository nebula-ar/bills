import { PurchaseStatus } from "@/generated/prisma/client";

// Lógica pura de cuentas a pagar: sin Prisma ni `new Date()` implícito (el
// "ahora" siempre entra por parámetro) para poder testear vencimientos.

export type PayableSummaryInput = {
  id: string;
  total: number;
  paid: number;
  status: PurchaseStatus;
  dueAt: Date | null;
};

// El estado sale de la plata, no de un campo que alguien tocó a mano.
export function resolvePurchaseStatus(total: number, paid: number, cancelled = false): PurchaseStatus {
  if (cancelled) {
    return PurchaseStatus.CANCELLED;
  }

  if (paid <= 0) {
    return PurchaseStatus.PENDING;
  }

  // `>=` y no `===`: si el proveedor cobró de más (redondeo, ajuste), la
  // factura igual está saldada.
  return paid >= total ? PurchaseStatus.PAID : PurchaseStatus.PARTIAL;
}

export function pendingAmount(purchase: { total: number; paid: number; status: PurchaseStatus }): number {
  if (purchase.status === PurchaseStatus.CANCELLED) {
    return 0;
  }

  return Math.max(purchase.total - purchase.paid, 0);
}

// Vencida = tiene saldo y la fecha de pago ya pasó.
export function isOverdue(purchase: PayableSummaryInput, at: Date): boolean {
  if (!purchase.dueAt || purchase.status === PurchaseStatus.PAID || purchase.status === PurchaseStatus.CANCELLED) {
    return false;
  }

  return purchase.dueAt < at && pendingAmount(purchase) > 0;
}

// Vence dentro de los próximos `days` días (y todavía no venció).
export function isDueSoon(purchase: PayableSummaryInput, at: Date, days = 7): boolean {
  if (!purchase.dueAt || pendingAmount(purchase) <= 0) {
    return false;
  }

  if (purchase.dueAt < at) {
    return false;
  }

  const limit = new Date(at.getTime() + days * 24 * 60 * 60 * 1000);
  return purchase.dueAt <= limit;
}

export type PayablesSummary = {
  // Deuda total con proveedores.
  pending: number;
  // De esa deuda, cuánto ya está vencido.
  overdue: number;
  // Cuánto vence en los próximos días.
  dueSoon: number;
  overdueCount: number;
  dueSoonCount: number;
  openCount: number;
};

// El resumen que va arriba de todo en la pantalla de proveedores y en el inicio:
// cuánto debo, cuánto ya se me pasó y qué se viene.
export function summarizePayables(purchases: PayableSummaryInput[], at: Date, dueSoonDays = 7): PayablesSummary {
  let pending = 0;
  let overdue = 0;
  let dueSoon = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let openCount = 0;

  for (const purchase of purchases) {
    const amount = pendingAmount(purchase);

    if (amount <= 0) {
      continue;
    }

    pending += amount;
    openCount += 1;

    if (isOverdue(purchase, at)) {
      overdue += amount;
      overdueCount += 1;
    } else if (isDueSoon(purchase, at, dueSoonDays)) {
      dueSoon += amount;
      dueSoonCount += 1;
    }
  }

  return { pending, overdue, dueSoon, overdueCount, dueSoonCount, openCount };
}
