import type { PaymentMethod, SaleStatus } from "@/generated/prisma/client";

import { findRecentSales } from "./sale.repository";

export type RecentSale = {
  id: string;
  soldAt: Date;
  total: number;
  status: SaleStatus;
  branchName: string;
  barberName: string;
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
    barberName: sale.barber.name,
    items: sale.items,
    payments: sale.payments,
  }));

  // Si trajimos la página completa, asumimos que hay más y devolvemos el cursor.
  const nextCursor = rows.length === safeLimit ? rows[rows.length - 1].id : null;

  return { sales, nextCursor };
}
