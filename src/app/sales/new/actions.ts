"use server";

import { PaymentMethod, SaleChannel, TaxCondition } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { getSaleErrorMessage, getSaleErrorMessageFor } from "@/lib/sale-error-messages";
import { parsePaymentMethod, parseRequiredString, parseSaleItemsFromFormData } from "@/lib/sale-form-parser";
import { linkAppointmentToSale } from "@/modules/appointments/appointment.use-cases";
import { createSale } from "@/modules/sales/create-sale.use-case";
import { createSimpleSale } from "@/modules/sales/create-simple-sale.use-case";
import { previewSaleTotals } from "@/modules/sales/preview-sale.use-case";
import { markQuoteConverted } from "@/modules/quotes/quote.use-cases";
import { closeOrderAfterSale } from "@/modules/tables/orders.use-cases";
import { SaleError } from "@/modules/sales/sale.errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos registrar la venta. Intentá de nuevo.";

export type SubmitSaleInput = {
  branchId: string;
  staffId: string;
  // Cliente de la ficha: obligatorio si algún pago va a cuenta corriente.
  customerId?: string;
  // Turno que se está cobrando, si la venta salió de la agenda.
  appointmentId?: string;
  // Presupuesto que se está cobrando, si la venta salió de una cotización.
  quoteId?: string;
  // Comanda que se está cobrando, si la venta salió del salón. Al confirmar,
  // la comanda queda pagada y la mesa se libera (ver closeOrderAfterSale).
  orderId?: string;
  // `quantity` viene en milésimas de unidad (ver src/lib/quantity.ts).
  items: { productId: string; quantity: number }[];
  payments: { method: PaymentMethod; amount: number }[];
  customerName?: string;
  customerTaxId?: string;
  customerTaxCondition?: TaxCondition;
  // Por dónde salió: mostrador, para llevar o servida en una mesa. Solo lo manda
  // el rubro que usa salón; el resto no lo elige y queda sin canal.
  channel?: SaleChannel;
  tableName?: string;
  waiterName?: string;
  // Propina del mozo. Solo tiene sentido cobrando una comanda.
  tip?: number;
  // El id de la mesa (no el nombre): hace falta para liberarla al cerrar la
  // comanda. Solo se manda junto con `orderId`.
  tableId?: string;
};

export type SubmitSaleResult = { ok: true } | { ok: false; error: string };

// Alta del POS admin: recibe datos estructurados (incluye pago dividido) y devuelve
// un resultado en vez de redirigir, para una UX fluida del lado del cliente.
export async function submitSale(input: SubmitSaleInput): Promise<SubmitSaleResult> {
  const session = await requireAdminSession();

  if (!input.branchId || !input.staffId) {
    return { ok: false, error: "Elegí sucursal y quién atiende." };
  }

  const items = (input.items ?? []).filter((item) => item.productId && item.quantity > 0);
  if (items.length === 0) {
    return { ok: false, error: "Agregá al menos un ítem." };
  }

  const payments = (input.payments ?? []).filter((payment) => payment.amount > 0);
  if (payments.length === 0) {
    return { ok: false, error: "Elegí el método de pago." };
  }

  try {
    const sale = await createSale({
      branchId: input.branchId,
      staffId: input.staffId,
      customerId: input.customerId,
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      payments,
      userId: session.user.id,
      customerName: input.customerName,
      customerTaxId: input.customerTaxId,
      customerTaxCondition: input.customerTaxCondition,
      channel: input.channel,
      tableName: input.tableName,
      waiterName: input.waiterName,
      tip: input.tip,
    });

    // La comanda queda pagada y la mesa se libera. La plata, el stock y el
    // costo ya quedaron bien arriba, en createSale: esto es solo lo que le
    // toca al salón. Deliberadamente sin deshacer la venta si esto falla —la
    // plata ya se cobró, y reintentar el cobro sería cobrar dos veces.
    if (input.orderId && input.tableId) {
      await closeOrderAfterSale({
        orderId: input.orderId,
        tableId: input.tableId,
        saleId: sale.id,
        total: sale.total,
        tip: sale.tip,
        staffId: session.user.id,
      }).catch((error) => {
        void logError("table.close-after-sale", error, {
          businessId: session.user.businessId,
          userId: session.user.id,
          context: { orderId: input.orderId, saleId: sale.id },
        });
      });
      revalidatePath("/salon");
      revalidatePath(`/salon/${input.tableId}`);
    }

    // El turno queda cobrado y enlazado: la agenda del día lo muestra así.
    if (input.appointmentId) {
      await linkAppointmentToSale({
        businessId: session.user.businessId,
        appointmentId: input.appointmentId,
        saleId: sale.id,
        userId: session.user.id,
      }).catch(() => {
        // Enlazar es secundario: la venta ya se cobró y no se vuelve atrás por esto.
      });
      revalidatePath("/turnos");
    }

    // Mismo criterio que el turno: la venta ya está cobrada, marcar el
    // presupuesto es contabilidad posterior y no puede voltearla.
    if (input.quoteId) {
      await markQuoteConverted({
        businessId: session.user.businessId,
        quoteId: input.quoteId,
        saleId: sale.id,
      }).catch(() => {});
      revalidatePath("/presupuestos");
    }

    revalidatePath("/");
    revalidatePath("/sales");
    revalidatePath("/stock");
    // La existencia también se ve en /catalog ahora (ver ProductsManager).
    revalidatePath("/catalog");

    return { ok: true };
  } catch (error) {
    if (error instanceof SaleError) {
      return { ok: false, error: getSaleErrorMessageFor(error) };
    }

    await logError("sale.create", error, { businessId: session.user.businessId, userId: session.user.id, context: { branchId: input.branchId, staffId: input.staffId } });
    return { ok: false, error: genericErrorMessage };
  }
}

export type PreviewSaleResult = {
  subtotal: number;
  discountTotal: number;
  total: number;
  discounts: { description: string; amount: number }[];
};

// Vista previa del cobro: corre el mismo motor de promociones que la venta real,
// para que el vendedor vea el total definitivo ANTES de cobrar. Solo lee.
export async function previewSale(input: {
  branchId: string;
  items: { productId: string; quantity: number }[];
}): Promise<PreviewSaleResult> {
  const session = await requireAdminSession();

  const empty: PreviewSaleResult = { subtotal: 0, discountTotal: 0, total: 0, discounts: [] };

  const items = (input.items ?? []).filter((item) => item.productId && item.quantity > 0);

  if (!input.branchId || items.length === 0) {
    return empty;
  }

  try {
    return await previewSaleTotals({
      businessId: session.user.businessId,
      branchId: input.branchId,
      items,
    });
  } catch (error) {
    await logError("sale.preview", error, { businessId: session.user.businessId, userId: session.user.id });
    return empty;
  }
}

export async function registerSale(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const staffId = parseRequiredString(formData, "staffId");
  const parsedItems = parseSaleItemsFromFormData(formData);
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));

  if (parsedItems.error) {
    redirectWithMessage("error", parsedItems.error);
  }

  if (!branchId || !staffId || !paymentMethod) {
    redirectWithMessage("error", "Completá todos los campos para registrar la venta.");
  }

  try {
    await createSimpleSale({
      branchId,
      staffId,
      items: parsedItems.items,
      paymentMethod,
    });
  } catch (error) {
    if (error instanceof SaleError) {
      redirectWithMessage("error", getSaleErrorMessage(error.code));
    }

    await logError("sale.create", error, { businessId: session.user.businessId, userId: session.user.id, context: { branchId, staffId } });
    redirectWithMessage("error", genericErrorMessage);
  }

  redirectWithMessage("success", "Venta registrada correctamente.");
}

function redirectWithMessage(status: "error" | "success", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/sales/new?${params.toString()}`);
}
