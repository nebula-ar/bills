"use server";

import type { SalesListSale } from "@/components/sales-list";
import { requireAdminSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { getInvoicingErrorMessage } from "@/lib/invoicing-error-messages";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { cancelSale } from "@/modules/sales/cancel-sale.use-case";
import { getRecentSales } from "@/modules/sales/get-recent-sales.use-case";
import { toSalesListSale } from "@/modules/sales/recent-sales-view";
import { SaleError } from "@/modules/sales/sale.errors";
import { attemptInvoiceEmission } from "@/modules/invoicing/attempt-invoice-emission.use-case";
import { InvoicingError } from "@/modules/invoicing/invoicing.errors";
import { findBusinessForInvoicing } from "@/modules/business/business.repository";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos cancelar la venta. Intentá de nuevo.";
const invoiceGenericErrorMessage = "No pudimos emitir la factura. Intentá de nuevo.";

export type EmitInvoiceResult = { ok: true } | { ok: false; error: string };

// Emisión de factura: no redirige (a diferencia de cancelSaleAction) para que
// el panel de detalle de la venta pueda mostrar el resultado sin cerrarse.
export async function emitInvoiceAction(saleId: string): Promise<EmitInvoiceResult> {
  const session = await requireAdminSession();

  try {
    const result = await attemptInvoiceEmission({ saleId, businessId: session.user.businessId });
    if (result.ok) {
      revalidatePath("/sales");
    }
    return result;
  } catch (error) {
    if (error instanceof InvoicingError) {
      return { ok: false, error: getInvoicingErrorMessage(error.code) };
    }

    await logError("invoice.emit", error, { businessId: session.user.businessId, userId: session.user.id, context: { saleId } });
    return { ok: false, error: invoiceGenericErrorMessage };
  }
}

const SALES_PAGE_SIZE = 20;

// Cargar la siguiente página del historial de ventas. El businessId sale de la
// sesión (no del cliente), así que el cursor no puede filtrar ventas ajenas.
export async function loadMoreSalesAction(
  cursor: string,
): Promise<{ sales: SalesListSale[]; nextCursor: string | null }> {
  const session = await requireAdminSession();
  const [{ sales, nextCursor }, business] = await Promise.all([
    getRecentSales(session.user.businessId, SALES_PAGE_SIZE, cursor),
    findBusinessForInvoicing(session.user.businessId),
  ]);
  const businessBasics = { cuit: business?.cuit ?? null, salesPointNumber: business?.salesPointNumber ?? null };
  return { sales: sales.map((sale) => toSalesListSale(sale, businessBasics)), nextCursor };
}

export async function cancelSaleAction(formData: FormData) {
  const session = await requireAdminSession();

  const saleId = parseRequiredString(formData, "saleId");
  const reason = parseOptionalString(formData, "reason");

  if (!saleId) {
    redirectWithMessage("error", "No encontramos la venta para cancelar.");
  }

  try {
    await cancelSale({ saleId, reason, businessId: session.user.businessId, userId: session.user.id });
  } catch (error) {
    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code));
    }

    await logError("sale.cancel", error, { businessId: session.user.businessId, userId: session.user.id, context: { saleId } });
    redirectWithMessage("error", genericErrorMessage);
  }

  revalidatePath("/sales");
  revalidatePath("/");
  redirectWithMessage("success", "Venta cancelada correctamente.");
}

function parseRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/sales?${params.toString()}`);
}
