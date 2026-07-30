import type { AfipStatus, InvoiceType, PaymentMethod, SaleStatus, TaxCondition } from "@/generated/prisma/client";

import { findRecentSales } from "./sale.repository";

export type RecentSale = {
  id: string;
  soldAt: Date;
  total: number;
  status: SaleStatus;
  branchName: string;
  staffName: string;
  customerName: string | null;
  customerPhone: string | null;
  customerTaxId: string | null;
  customerTaxCondition: TaxCondition;
  invoiceType: InvoiceType | null;
  afipStatus: AfipStatus;
  cae: string | null;
  caeVencimiento: Date | null;
  afipVoucherNumber: number | null;
  afipError: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    total: number;
  }[];
  payments: {
    id: string;
    method: PaymentMethod;
    amount: number;
  }[];
};

export type RecentSalesPage = {
  sales: RecentSale[];
  nextCursor: string | null;
};

export async function getRecentSales(
  businessId: string,
  limit = 10,
  cursor?: string,
): Promise<RecentSalesPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await findRecentSales(businessId, safeLimit, cursor);

  const sales = rows.map((sale) => ({
    id: sale.id,
    soldAt: sale.soldAt,
    total: sale.total,
    status: sale.status,
    branchName: sale.branch.name,
    staffName: sale.staff.name,
    customerName: sale.customer?.name ?? sale.customerName,
    customerPhone: sale.customer?.phone ?? null,
    customerTaxId: sale.customerTaxId,
    customerTaxCondition: sale.customerTaxCondition,
    invoiceType: sale.invoiceType,
    afipStatus: sale.afipStatus,
    cae: sale.cae,
    caeVencimiento: sale.caeVencimiento,
    afipVoucherNumber: sale.afipVoucherNumber,
    afipError: sale.afipError,
    items: sale.items,
    payments: sale.payments,
  }));

  // Si trajimos la página completa, asumimos que hay más y devolvemos el cursor.
  const nextCursor = rows.length === safeLimit ? rows[rows.length - 1].id : null;

  return { sales, nextCursor };
}
