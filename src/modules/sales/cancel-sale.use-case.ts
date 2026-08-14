import { AfipStatus, PaymentMethod, SaleStatus } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";

import { cancelSaleTransaction, findSaleForCancellation } from "./sale.repository";
import { SaleError, SaleErrorCode } from "./sale.errors";

const cancellationNotePrefix = "Cancellation reason";

export type CancelSaleInput = {
  saleId: string;
  reason?: string;
  businessId?: string;
  userId?: string | null;
};

// Anular no borra: revierte. Devuelve al stock lo que había salido y compensa
// el fiado con un asiento contrario, así el libro sigue explicando todo.
export async function cancelSale(input: CancelSaleInput) {
  const sale = await findSaleForCancellation(input.saleId, input.businessId);

  if (!sale) {
    throw new SaleError(SaleErrorCode.SALE_NOT_FOUND);
  }

  if (sale.status === SaleStatus.CANCELLED) {
    throw new SaleError(SaleErrorCode.SALE_ALREADY_CANCELLED);
  }

  // Una venta con comprobante AFIP/ARCA emitido no se anula sin anular primero
  // el comprobante (nota de crédito): dejaría una factura viva sobre una venta
  // cancelada. El historial de ventas y la grilla de Facturación comparten este
  // guard del lado del servidor.
  if (sale.afipStatus === AfipStatus.ISSUED) {
    throw new SaleError(SaleErrorCode.SALE_HAS_ISSUED_INVOICE);
  }

  const notes = buildCancellationNotes(sale.notes, input.reason);

  const restockItems = sale.items.flatMap((item) =>
    item.productId && item.product?.trackStock
      ? [{ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost }]
      : [],
  );

  const accountCharge = sale.payments
    .filter((payment) => payment.method === PaymentMethod.ACCOUNT)
    .reduce((total, payment) => total + payment.amount, 0);

  const cancelled = await cancelSaleTransaction({
    saleId: sale.id,
    branchId: sale.branchId,
    notes,
    restockItems,
    customerId: sale.customerId,
    accountCharge,
    userId: input.userId,
  });

  await logEvent("sale.cancel", "Venta anulada", {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: {
      saleId: sale.id,
      branchId: sale.branchId,
      restocked: restockItems.length,
      accountCharge,
      reason: input.reason ?? null,
    },
  });

  return cancelled;
}

function buildCancellationNotes(currentNotes: string | null, reason: string | undefined) {
  const trimmedReason = reason?.trim();

  if (!trimmedReason) {
    return undefined;
  }

  const cancellationNote = `${cancellationNotePrefix}: ${trimmedReason}`;

  return currentNotes ? `${currentNotes}\n${cancellationNote}` : cancellationNote;
}
