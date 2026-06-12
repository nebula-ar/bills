import type { PaymentMethod } from "@/generated/prisma/client";

import { findRecentSales } from "./sale.repository";

export type RecentSale = {
  id: string;
  soldAt: Date;
  total: number;
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

export async function getRecentSales(limit = 10): Promise<RecentSale[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const sales = await findRecentSales(safeLimit);

  return sales.map((sale) => ({
    id: sale.id,
    soldAt: sale.soldAt,
    total: sale.total,
    branchName: sale.branch.name,
    barberName: sale.barber.name,
    items: sale.items,
    payments: sale.payments,
  }));
}
