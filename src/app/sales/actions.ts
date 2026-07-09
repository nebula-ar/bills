"use server";

import type { SalesListSale } from "@/components/sales-list";
import { requireAdminSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { cancelSale } from "@/modules/sales/cancel-sale.use-case";
import { getRecentSales } from "@/modules/sales/get-recent-sales.use-case";
import { toSalesListSale } from "@/modules/sales/recent-sales-view";
import { SaleError } from "@/modules/sales/sale.errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos cancelar la venta. Intentá de nuevo.";

const SALES_PAGE_SIZE = 20;

// Cargar la siguiente página del historial de ventas. El businessId sale de la
// sesión (no del cliente), así que el cursor no puede filtrar ventas ajenas.
export async function loadMoreSalesAction(
  cursor: string,
): Promise<{ sales: SalesListSale[]; nextCursor: string | null }> {
  const session = await requireAdminSession();
  const { sales, nextCursor } = await getRecentSales(session.user.businessId, SALES_PAGE_SIZE, cursor);
  return { sales: sales.map(toSalesListSale), nextCursor };
}

export async function cancelSaleAction(formData: FormData) {
  const session = await requireAdminSession();

  const saleId = parseRequiredString(formData, "saleId");
  const reason = parseOptionalString(formData, "reason");

  if (!saleId) {
    redirectWithMessage("error", "No encontramos la venta para cancelar.");
  }

  try {
    await cancelSale({ saleId, reason });
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
