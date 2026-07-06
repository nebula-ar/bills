"use server";

import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getSaleErrorMessage } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString, parseSaleItemsFromFormData } from "@/lib/sale-form-parser";
import { createSale } from "@/modules/sales/create-sale.use-case";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { SaleError } from "@/modules/sales/sale.errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos registrar la venta. Intentá de nuevo.";

export type SubmitSaleInput = {
  branchId: string;
  barberId: string;
  items: { serviceId: string; quantity: number }[];
  payments: { method: PaymentMethod; amount: number }[];
};

export type SubmitSaleResult = { ok: true } | { ok: false; error: string };

// Alta del POS admin: recibe datos estructurados (incluye pago dividido) y devuelve
// un resultado en vez de redirigir, para una UX fluida del lado del cliente.
export async function submitSale(input: SubmitSaleInput): Promise<SubmitSaleResult> {
  await requireAdminSession();

  if (!input.branchId || !input.barberId) {
    return { ok: false, error: "Elegí sucursal y barbero." };
  }

  const items = (input.items ?? []).filter((item) => item.serviceId && item.quantity > 0);
  if (items.length === 0) {
    return { ok: false, error: "Agregá al menos un servicio." };
  }

  const payments = (input.payments ?? []).filter((payment) => payment.amount > 0);
  if (payments.length === 0) {
    return { ok: false, error: "Elegí el método de pago." };
  }

  try {
    await createSale({
      branchId: input.branchId,
      barberId: input.barberId,
      items: items.map((item) => ({ serviceId: item.serviceId, quantity: item.quantity })),
      payments,
    });

    revalidatePath("/");
    revalidatePath("/sales");

    return { ok: true };
  } catch (error) {
    if (error instanceof SaleError) {
      return { ok: false, error: getSaleErrorMessage(error.code) };
    }

    console.error(error);
    return { ok: false, error: genericErrorMessage };
  }
}

export async function registerSale(formData: FormData) {
  await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const barberId = parseRequiredString(formData, "barberId");
  const parsedItems = parseSaleItemsFromFormData(formData);
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));

  if (parsedItems.error) {
    redirectWithMessage("error", parsedItems.error);
  }

  if (!branchId || !barberId || !paymentMethod) {
    redirectWithMessage("error", "Completá todos los campos para registrar la venta.");
  }

  try {
    await createSimpleSale({
      branchId,
      barberId,
      items: parsedItems.items,
      paymentMethod,
    });
  } catch (error) {
    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code));
    }

    console.error(error);
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", "Venta registrada correctamente.");
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/sales/new?${params.toString()}`);
}
