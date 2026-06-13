import type { PaymentMethod } from "@/generated/prisma/client";

import { createSale } from "./create-sale.use-case";
import { SaleError, SaleErrorCode } from "./sale.errors";
import { findBranchServicePrices } from "./sale.repository";

export type CreateSimpleSaleItemInput = {
  serviceId: string;
  quantity: number;
};

export type CreateSimpleSaleInput = {
  branchId: string;
  barberId: string;
  items: CreateSimpleSaleItemInput[];
  paymentMethod: PaymentMethod;
};

export async function createSimpleSale(input: CreateSimpleSaleInput) {
  if (input.items.length === 0) {
    throw new SaleError(SaleErrorCode.EMPTY_ITEMS);
  }

  const servicePrices = await findBranchServicePrices(
    input.branchId,
    uniqueServiceIds(input.items),
  );
  const servicePriceByServiceId = new Map(
    servicePrices.map((servicePrice) => [servicePrice.serviceId, servicePrice]),
  );

  const total = input.items.reduce((sum, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new SaleError(SaleErrorCode.INVALID_ITEM_QUANTITY);
    }

    const servicePrice = servicePriceByServiceId.get(item.serviceId);

    if (!servicePrice) {
      throw new SaleError(SaleErrorCode.SERVICE_NOT_AVAILABLE);
    }

    return sum + servicePrice.price * item.quantity;
  }, 0);

  if (total <= 0) {
    throw new SaleError(SaleErrorCode.EMPTY_ITEMS);
  }

  return createSale({
    branchId: input.branchId,
    barberId: input.barberId,
    items: input.items,
    payments: [
      {
        method: input.paymentMethod,
        amount: total,
      },
    ],
  });
}

function uniqueServiceIds(items: CreateSimpleSaleItemInput[]) {
  return [...new Set(items.map((item) => item.serviceId))];
}
