import { SaleStatus } from "@/generated/prisma/client";

import { cancelSaleById, findSaleForCancellation } from "./sale.repository";
import { SaleError, SaleErrorCode } from "./sale.errors";

const cancellationNotePrefix = "Cancellation reason";

export type CancelSaleInput = {
  saleId: string;
  reason?: string;
};

export async function cancelSale(input: CancelSaleInput) {
  const sale = await findSaleForCancellation(input.saleId);

  if (!sale) {
    throw new SaleError(SaleErrorCode.SALE_NOT_FOUND);
  }

  if (sale.status === SaleStatus.CANCELLED) {
    throw new SaleError(SaleErrorCode.SALE_ALREADY_CANCELLED);
  }

  const notes = buildCancellationNotes(sale.notes, input.reason);

  return cancelSaleById({
    saleId: sale.id,
    notes,
  });
}

function buildCancellationNotes(currentNotes: string | null, reason: string | undefined) {
  const trimmedReason = reason?.trim();

  if (!trimmedReason) {
    return undefined;
  }

  const cancellationNote = `${cancellationNotePrefix}: ${trimmedReason}`;

  return currentNotes ? `${currentNotes}\n${cancellationNote}` : cancellationNote;
}
