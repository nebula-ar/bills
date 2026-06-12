import type { PaymentMethod } from "@/generated/prisma/client";

import { createSale } from "./create-sale.use-case";
import { SaleError, SaleErrorCode } from "./sale.errors";
import { findBranchServicePriceById } from "./sale.repository";

export type CreateSimpleSaleInput = {
  branchId: string;
  barberId: string;
  servicePriceId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
};

export async function createSimpleSale(input: CreateSimpleSaleInput) {
  const servicePrice = await findBranchServicePriceById(input.branchId, input.servicePriceId);

  if (!servicePrice) {
    throw new SaleError(SaleErrorCode.SERVICE_NOT_AVAILABLE);
  }

  return createSale({
    branchId: input.branchId,
    barberId: input.barberId,
    items: [
      {
        serviceId: servicePrice.serviceId,
        quantity: input.quantity,
      },
    ],
    payments: [
      {
        method: input.paymentMethod,
        amount: servicePrice.price * input.quantity,
      },
    ],
  });
}
