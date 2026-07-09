import type { PaymentMethod } from "@/generated/prisma/client";

import { createSale } from "./create-sale.use-case";
import { SaleError, SaleErrorCode } from "./sale.errors";

export type CreateSimpleSaleItemInput = {
  serviceId: string;
  quantity: number;
};

export type CreateSimpleSaleInput = {
  branchId: string;
  barberId: string;
  terminalId?: string | null;
  items: CreateSimpleSaleItemInput[];
  paymentMethod: PaymentMethod;
};

// Venta rápida (terminal del barbero): delega en createSale, que ya calcula el
// total a partir de los precios de la sucursal y crea un único pago con el método
// elegido. Antes se consultaban los precios acá y otra vez en createSale.
export async function createSimpleSale(input: CreateSimpleSaleInput) {
  if (input.items.length === 0) {
    throw new SaleError(SaleErrorCode.EMPTY_ITEMS);
  }

  return createSale({
    branchId: input.branchId,
    barberId: input.barberId,
    terminalId: input.terminalId ?? null,
    items: input.items,
    payments: [],
    autoPaymentMethod: input.paymentMethod,
  });
}
