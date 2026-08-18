import { SaleStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { CustomerActivity } from "./marketing.logic";

// Acceso a datos de marketing. Sin reglas: acá solo se lee y se escribe.

// Actividad de cada cliente: cuánto compró, cuántas veces y cuándo fue la
// última. Se arma con un groupBy sobre ventas y no cliente por cliente, que con
// 500 fichas serían 500 consultas.
export async function findCustomerActivity(businessId: string): Promise<CustomerActivity[]> {
  const [customers, activity] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId, deleted: false, active: true },
      select: { id: true, name: true, phone: true, birthday: true },
      orderBy: { name: "asc" },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        deleted: false,
        status: SaleStatus.COMPLETED,
        customerId: { not: null },
        branch: { businessId, deleted: false },
      },
      _count: { _all: true },
      _sum: { total: true },
      _max: { soldAt: true },
    }),
  ]);

  const byCustomer = new Map(activity.map((row) => [row.customerId as string, row]));

  return customers.map((customer) => {
    const row = byCustomer.get(customer.id);

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      birthday: customer.birthday,
      lastPurchaseAt: row?._max.soldAt ?? null,
      purchaseCount: row?._count._all ?? 0,
      totalSpent: row?._sum.total ?? 0,
    };
  });
}

// Tickets recientes para el análisis de "se venden juntos". Solo se traen los
// nombres: es lo único que hace falta y evita cargar la venta entera.
export async function findRecentBaskets(businessId: string, from: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      deleted: false,
      status: SaleStatus.COMPLETED,
      soldAt: { gte: from },
      branch: { businessId, deleted: false },
    },
    select: {
      items: { where: { deleted: false }, select: { description: true } },
    },
  });

  return sales.map((sale) => ({ productIds: sale.items.map((item) => item.description) }));
}

export function findLoyaltyEntries(customerId: string, businessId: string) {
  return prisma.loyaltyEntry.findMany({
    where: { customerId, customer: { businessId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, points: true, note: true, saleId: true, createdAt: true },
  });
}

// Saldo de puntos de todos los clientes del negocio, en una sola consulta.
export async function findLoyaltyBalances(businessId: string): Promise<Map<string, number>> {
  const rows = await prisma.loyaltyEntry.groupBy({
    by: ["customerId"],
    where: { businessId },
    _sum: { points: true },
  });

  return new Map(rows.map((row) => [row.customerId, row._sum.points ?? 0]));
}
