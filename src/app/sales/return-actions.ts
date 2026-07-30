"use server";

import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { parsePaymentMethodValue } from "@/lib/payment-labels";
import { formatQuantity } from "@/lib/quantity";
import { getReturnableSale, registerSaleReturn } from "@/modules/sales/return-sale.use-case";
import { ReturnError, ReturnErrorCode } from "@/modules/sales/return.logic";
import { SaleError } from "@/modules/sales/sale.errors";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { revalidatePath } from "next/cache";

export type ReturnableLine = {
  saleItemId: string;
  description: string;
  // Todo en milésimas.
  pending: number;
  unit: string;
};

export type ReturnableResult =
  | { ok: true; lines: ReturnableLine[]; hasCustomer: boolean }
  | { ok: false; error: string };

// Qué se puede devolver de una venta. Se consulta al abrir la hoja: puede haber
// devoluciones previas y no tiene sentido ofrecer lo que ya volvió.
export async function getReturnableLines(saleId: string): Promise<ReturnableResult> {
  const session = await requireAdminSession();

  const sale = await getReturnableSale(saleId, session.user.businessId);

  if (!sale) {
    return { ok: false, error: "No encontramos la venta." };
  }

  if (sale.status === "CANCELLED") {
    return { ok: false, error: "La venta está anulada: ya se devolvió entera." };
  }

  const lines = sale.items
    .map((item) => ({
      saleItemId: item.saleItemId,
      description: item.description,
      pending: Math.max(item.soldQuantity - item.returnedQuantity, 0),
      unit: item.unit,
    }))
    .filter((line) => line.pending > 0);

  return { ok: true, lines, hasCustomer: Boolean(sale.customerId) };
}

export type RegisterReturnResult = { ok: true; total: number } | { ok: false; error: string };

export async function registerReturn(input: {
  saleId: string;
  lines: { saleItemId: string; quantity: number }[];
  method: PaymentMethod;
  reason?: string;
}): Promise<RegisterReturnResult> {
  const session = await requireAdminSession();

  const lines = (input.lines ?? []).filter((line) => line.quantity > 0);

  if (lines.length === 0) {
    return { ok: false, error: "Elegí qué se devuelve." };
  }

  try {
    const result = await registerSaleReturn({
      businessId: session.user.businessId,
      saleId: input.saleId,
      lines,
      method: parsePaymentMethodValue(input.method) ?? PaymentMethod.CASH,
      reason: input.reason,
      userId: session.user.id,
    });

    revalidatePath("/sales");
    revalidatePath("/stock");
    revalidatePath("/");

    return { ok: true, total: result.total };
  } catch (error) {
    if (error instanceof ReturnError) {
      return { ok: false, error: returnMessage(error) };
    }

    if (error instanceof SaleError) {
      return { ok: false, error: getSaleErrorMessage(error.code) };
    }

    await logError("sale.return", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { saleId: input.saleId },
    });

    return { ok: false, error: "No pudimos registrar la devolución. Intentá de nuevo." };
  }
}

function returnMessage(error: ReturnError): string {
  switch (error.code) {
    case ReturnErrorCode.EXCEEDS_SOLD:
      return `De ${error.detail?.description ?? "ese ítem"} quedan ${formatQuantity(error.detail?.available ?? 0)} por devolver.`;
    case ReturnErrorCode.NOTHING_TO_RETURN:
      return "Elegí al menos un ítem para devolver.";
    case ReturnErrorCode.INVALID_QUANTITY:
      return "La cantidad a devolver no es válida.";
    default:
      return "Ese ítem no pertenece a la venta.";
  }
}
