import { PaymentMethod } from "@/generated/prisma/client";
import type { SalesListSale } from "@/components/sales-list";

import type { RecentSale } from "./get-recent-sales.use-case";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.MERCADO_PAGO]: "Mercado Pago",
  [PaymentMethod.OTHER]: "Otro",
};

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function summarizePayments(payments: { method: PaymentMethod }[]) {
  if (payments.length === 0) return "Sin pago";
  const methods = new Set(payments.map((payment) => payment.method));
  if (methods.size > 1) return "Mixto";
  return paymentMethodLabels[payments[0].method];
}

// Mapea una venta del dominio al DTO que consume <SalesList/>. Compartido entre
// la página (render inicial) y la server action de "cargar más".
export function toSalesListSale(sale: RecentSale): SalesListSale {
  return {
    id: sale.id,
    timeLabel: timeFormatter.format(sale.soldAt),
    dateLabel: dayFormatter.format(sale.soldAt),
    barberName: sale.barberName,
    branchName: sale.branchName,
    total: sale.total,
    status: sale.status,
    itemSummary: sale.items.map((item) => `${item.description} x${item.quantity}`).join(", "),
    paymentSummary: summarizePayments(sale.payments),
    items: sale.items,
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      label: paymentMethodLabels[payment.method],
      amount: payment.amount,
    })),
  };
}
