import { PaymentMethod } from "@/generated/prisma/client";
import type { SalesListSale } from "@/components/sales-list";
import { buildAfipQrUrl } from "@/lib/afip-qr";
import { INVOICE_TYPE_CODES } from "@/lib/invoice";
import { formatQuantity } from "@/lib/quantity";
import { resolveAfipDocument } from "@/lib/tax-id";

import type { RecentSale } from "./get-recent-sales.use-case";

export type InvoicingBusinessBasics = { cuit: string | null; salesPointNumber: number | null };

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.MERCADO_PAGO]: "Mercado Pago",
  [PaymentMethod.ACCOUNT]: "Cuenta corriente",
  [PaymentMethod.OTHER]: "Otro",
};

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function summarizePayments(payments: { method: PaymentMethod }[]) {
  if (payments.length === 0) return "Sin pago";
  const methods = new Set(payments.map((payment) => payment.method));
  if (methods.size > 1) return "Mixto";
  return paymentMethodLabels[payments[0].method];
}

// Mapea una venta del dominio al DTO que consume <SalesList/>. Compartido entre
// la página (render inicial) y la server action de "cargar más". `business` se
// necesita solo para armar el QR fiscal (RG 4291/2018) de ventas ya facturadas.
export function toSalesListSale(sale: RecentSale, business: InvoicingBusinessBasics): SalesListSale {
  return {
    id: sale.id,
    timeLabel: timeFormatter.format(sale.soldAt),
    dateLabel: dayFormatter.format(sale.soldAt),
    staffName: sale.staffName,
    branchName: sale.branchName,
    total: sale.total,
    status: sale.status,
    itemSummary: sale.items.map((item) => `${item.description} x${formatQuantity(item.quantity)}`).join(", "),
    paymentSummary: summarizePayments(sale.payments),
    items: sale.items,
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      label: paymentMethodLabels[payment.method],
      amount: payment.amount,
    })),
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerTaxId: sale.customerTaxId,
    invoiceType: sale.invoiceType,
    afipStatus: sale.afipStatus,
    afipError: sale.afipError,
    cae: sale.cae,
    caeVencimiento: sale.caeVencimiento ? sale.caeVencimiento.toISOString() : null,
    qrUrl: buildQrUrlIfIssued(sale, business),
  };
}

function buildQrUrlIfIssued(sale: RecentSale, business: InvoicingBusinessBasics): string | null {
  if (sale.afipStatus !== "ISSUED" || !sale.cae || !sale.invoiceType || sale.afipVoucherNumber == null) return null;
  if (!business.cuit || business.salesPointNumber == null) return null;

  const { docTipo, docNro } = resolveAfipDocument(sale.customerTaxId);

  return buildAfipQrUrl({
    fecha: sale.soldAt.toISOString().slice(0, 10),
    cuit: business.cuit,
    ptoVta: business.salesPointNumber,
    tipoCmp: INVOICE_TYPE_CODES[sale.invoiceType],
    nroCmp: sale.afipVoucherNumber,
    importe: sale.total,
    docTipo,
    docNro,
    cae: sale.cae,
  });
}
