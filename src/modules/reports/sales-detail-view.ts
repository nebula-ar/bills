import type { PaymentMethod } from "@/generated/prisma/client";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { formatQuantity } from "@/lib/quantity";

// Fila del grid "Detalle de ventas" del dashboard (Syncfusion EJ2 DataGrid).
// Una fila por venta del período, ya resuelta para mostrar:
//   - dateLabel:   "12/12 09:07", para la celda.
//   - soldAtLabel: "2026-12-12 09:07", para ordenar y exportar (ISO-ish,
//                  orden cronológico por string y legible en la planilla).
// El mapper es lógica pura con tests; la página server arma las filas y el
// grid (cliente) solo las muestra y exporta.

export type SalesDetailRow = {
  id: string;
  dateLabel: string;
  soldAtLabel: string;
  shortId: string;
  staffName: string;
  branchName: string;
  customerLabel: string;
  paymentLabel: string;
  itemSummary: string;
  total: number;
};

// La forma mínima que necesita el mapper. El repo devuelve más campos; la
// página los mapea a esta forma antes de llamar (branch.name -> branchName,
// customer resuelto -> customerLabel, etc.).
export type SalesDetailSale = {
  id: string;
  soldAt: Date;
  total: number;
  branchName: string;
  staffName: string;
  customerLabel: string;
  items: { description: string; quantity: number }[];
  payments: { method: PaymentMethod; amount: number }[];
};

// "Mixto" / "Sin pago" / el método único, igual que el resumen del dashboard.
// `amount` es opcional en el tipo porque solo importa el método para resumir.
export function summarizePayments(payments: readonly { method: PaymentMethod; amount?: number }[]): string {
  if (payments.length === 0) return "Sin pago";
  const methods = new Set(payments.map((payment) => payment.method));
  if (methods.size > 1) return "Mixto";
  return PAYMENT_METHOD_LABELS[payments[0].method];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// "2026-12-12 09:07": ordenable por string y exportable sin ambigüedad.
function toSoldAtLabel(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "12/12 09:07": compacto para la celda del grid.
function toDateLabel(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Los ids son cuid: no se tipean, pero sirven como identificador estable
// (misma convención que la exportación para el contador).
function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

export function toSalesDetailRows(sales: SalesDetailSale[]): SalesDetailRow[] {
  return sales.map((sale) => ({
    id: sale.id,
    dateLabel: toDateLabel(sale.soldAt),
    soldAtLabel: toSoldAtLabel(sale.soldAt),
    shortId: shortId(sale.id),
    staffName: sale.staffName,
    branchName: sale.branchName,
    customerLabel: sale.customerLabel,
    paymentLabel: summarizePayments(sale.payments),
    itemSummary: sale.items.map((item) => `${item.description} x${formatQuantity(item.quantity)}`).join(", "),
    total: sale.total,
  }));
}
