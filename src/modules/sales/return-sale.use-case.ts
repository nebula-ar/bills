import { PaymentMethod, SaleStatus, StockMovementType } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { reverseCustomerCharge } from "@/modules/customers/customer.repository";
import { applyStockMovement } from "@/modules/stock/stock.repository";

import { quoteReturn, ReturnError, ReturnErrorCode, type ReturnableItem, type ReturnLine } from "./return.logic";
import { SaleError, SaleErrorCode } from "./sale.errors";

// Devolución parcial: el cliente trae parte de lo que compró.
//
// Tres cosas pasan juntas y ninguna puede quedar a medias:
//   1. Queda el registro de qué se devolvió (para que la venta original siga
//      contando lo que realmente pasó).
//   2. La mercadería vuelve al stock.
//   3. La plata sale de la caja — o le baja la deuda al cliente, si se devuelve
//      "a cuenta" (que es lo que hace un local de ropa con una nota de crédito).

export async function getReturnableSale(saleId: string, businessId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, deleted: false, branch: { businessId } },
    select: {
      id: true,
      status: true,
      total: true,
      soldAt: true,
      branchId: true,
      customerId: true,
      items: {
        where: { deleted: false },
        select: {
          id: true,
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          discount: true,
          unitCost: true,
          productId: true,
          product: { select: { trackStock: true } },
          returns: { select: { quantity: true } },
        },
      },
      returns: { select: { id: true, total: true, method: true, returnedAt: true, reason: true } },
    },
  });

  if (!sale) {
    return null;
  }

  const items = sale.items.map((item) => ({
    saleItemId: item.id,
    description: item.description,
    unit: item.unit,
    soldQuantity: item.quantity,
    returnedQuantity: item.returns.reduce((sum, entry) => sum + entry.quantity, 0),
    unitPrice: item.unitPrice,
    discount: item.discount,
    unitCost: item.unitCost,
    productId: item.productId,
    trackStock: item.product?.trackStock ?? false,
  }));

  return {
    ...sale,
    items,
    returnedTotal: sale.returns.reduce((sum, entry) => sum + entry.total, 0),
  };
}

export type RegisterReturnInput = {
  businessId: string;
  saleId: string;
  lines: ReturnLine[];
  method: PaymentMethod;
  reason?: string | null;
  userId?: string | null;
};

export async function registerSaleReturn(input: RegisterReturnInput) {
  const sale = await getReturnableSale(input.saleId, input.businessId);

  if (!sale) {
    throw new SaleError(SaleErrorCode.SALE_NOT_FOUND);
  }

  // Una venta anulada ya devolvió todo: no hay nada que devolver de nuevo.
  if (sale.status === SaleStatus.CANCELLED) {
    throw new SaleError(SaleErrorCode.SALE_ALREADY_CANCELLED);
  }

  const returnable: ReturnableItem[] = sale.items.map((item) => ({
    saleItemId: item.saleItemId,
    description: item.description,
    soldQuantity: item.soldQuantity,
    returnedQuantity: item.returnedQuantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
  }));

  const quote = quoteReturn(returnable, input.lines);

  // Devolver "a cuenta" solo tiene sentido si la venta tiene cliente: si no, no
  // hay a quién acreditarle nada.
  if (input.method === PaymentMethod.ACCOUNT && !sale.customerId) {
    throw new ReturnError(ReturnErrorCode.NOTHING_TO_RETURN);
  }

  const itemsById = new Map(sale.items.map((item) => [item.saleItemId, item]));

  const created = await prisma.$transaction(async (tx) => {
    const saleReturn = await tx.saleReturn.create({
      data: {
        saleId: sale.id,
        branchId: sale.branchId,
        total: quote.total,
        method: input.method,
        reason: input.reason?.trim() || null,
        createdById: input.userId,
        items: {
          create: quote.lines.map((line) => ({
            saleItemId: line.saleItemId,
            quantity: line.quantity,
            amount: line.amount,
          })),
        },
      },
      select: { id: true },
    });

    for (const line of quote.lines) {
      const item = itemsById.get(line.saleItemId);

      if (!item?.productId || !item.trackStock) {
        continue;
      }

      await applyStockMovement(tx, {
        branchId: sale.branchId,
        productId: item.productId,
        type: StockMovementType.RETURN,
        quantity: line.quantity,
        unitCost: item.unitCost,
        reason: "Devolución del cliente",
        saleId: sale.id,
        createdById: input.userId,
      });
    }

    // A cuenta: en vez de darle plata, se le baja la deuda.
    if (input.method === PaymentMethod.ACCOUNT && sale.customerId) {
      await reverseCustomerCharge(tx, {
        customerId: sale.customerId,
        branchId: sale.branchId,
        amount: quote.total,
        saleId: sale.id,
        userId: input.userId,
      });
    }

    return saleReturn;
  });

  await logEvent("sale.return", `Devolución de $${quote.total}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: {
      saleId: sale.id,
      returnId: created.id,
      total: quote.total,
      method: input.method,
      lines: quote.lines.length,
    },
  });

  return { id: created.id, total: quote.total };
}

// Devoluciones por método, para que la caja las cuente como salida de plata.
// Las hechas "a cuenta" quedan afuera: ahí no salió un peso del cajón.
export async function findReturnsByMethod(scope: {
  businessId: string;
  branchId?: string | null;
  from?: Date;
  to?: Date;
}) {
  const grouped = await prisma.saleReturn.groupBy({
    by: ["method"],
    where: {
      method: { not: PaymentMethod.ACCOUNT },
      branch: { businessId: scope.businessId },
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(scope.from || scope.to
        ? {
            returnedAt: {
              ...(scope.from ? { gte: scope.from } : {}),
              ...(scope.to ? { lte: scope.to } : {}),
            },
          }
        : {}),
    },
    _sum: { total: true },
  });

  return new Map<PaymentMethod, number>(grouped.map((row) => [row.method, row._sum.total ?? 0]));
}
