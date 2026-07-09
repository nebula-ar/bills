import { PaymentMethod, UserRole } from "@/generated/prisma/client";

import type { CreateSaleDto } from "./create-sale.dto";
import {
  createSaleTransaction,
  findBranchServicePrices,
  findSaleBarber,
  findSaleBranch,
  type CreateSaleRepositoryItem,
} from "./sale.repository";
import { SaleError, SaleErrorCode } from "./sale.errors";

export async function createSale(input: CreateSaleDto) {
  validateSaleInputShape(input);

  const [branch, barber, servicePrices] = await Promise.all([
    findSaleBranch(input.branchId),
    findSaleBarber(input.barberId),
    findBranchServicePrices(input.branchId, uniqueServiceIds(input.items)),
  ]);

  if (!branch || branch.deleted) {
    throw new SaleError(SaleErrorCode.BRANCH_NOT_FOUND);
  }

  if (!barber || barber.deleted || !barber.active) {
    throw new SaleError(SaleErrorCode.BARBER_NOT_AVAILABLE);
  }

  if (barber.role !== UserRole.BARBER) {
    throw new SaleError(SaleErrorCode.BARBER_INVALID_ROLE);
  }

  if (barber.branchId !== input.branchId) {
    throw new SaleError(SaleErrorCode.BARBER_WRONG_BRANCH);
  }

  const servicePriceByServiceId = new Map(
    servicePrices.map((servicePrice) => [servicePrice.serviceId, servicePrice]),
  );

  const saleItems: CreateSaleRepositoryItem[] = input.items.map((item) => {
    if (!item.serviceId) {
      const description = item.description?.trim();

      if (!description) {
        throw new SaleError(SaleErrorCode.INVALID_MANUAL_EXTRA_DESCRIPTION);
      }

      if (!Number.isInteger(item.unitPrice) || !item.unitPrice || item.unitPrice <= 0) {
        throw new SaleError(SaleErrorCode.INVALID_MANUAL_EXTRA_PRICE);
      }

      const total = item.unitPrice * item.quantity;

      return {
        serviceId: null,
        description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total,
      };
    }

    const servicePrice = servicePriceByServiceId.get(item.serviceId);

    if (!servicePrice) {
      throw new SaleError(SaleErrorCode.SERVICE_NOT_AVAILABLE);
    }

    const total = servicePrice.price * item.quantity;

    return {
      serviceId: item.serviceId,
      description: servicePrice.service.name,
      quantity: item.quantity,
      unitPrice: servicePrice.price,
      total,
    };
  });

  const saleTotal = sum(saleItems.map((item) => item.total));

  // Venta rápida: un único pago por el total calculado (no revalidamos contra un
  // total que el caller ya no tuvo que recalcular).
  const payments =
    input.payments.length > 0
      ? input.payments
      : [{ method: input.autoPaymentMethod as PaymentMethod, amount: saleTotal }];

  const paymentsTotal = sum(payments.map((payment) => payment.amount));

  if (paymentsTotal !== saleTotal) {
    throw new SaleError(SaleErrorCode.PAYMENTS_TOTAL_MISMATCH);
  }

  return createSaleTransaction({
    branchId: input.branchId,
    barberId: input.barberId,
    terminalId: input.terminalId ?? null,
    total: saleTotal,
    items: saleItems,
    payments,
    notes: input.notes,
    soldAt: input.soldAt,
  });
}

function validateSaleInputShape(input: CreateSaleDto) {
  if (input.items.length === 0) {
    throw new SaleError(SaleErrorCode.EMPTY_ITEMS);
  }

  if (input.payments.length === 0 && !input.autoPaymentMethod) {
    throw new SaleError(SaleErrorCode.EMPTY_PAYMENTS);
  }

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new SaleError(SaleErrorCode.INVALID_ITEM_QUANTITY);
    }
  }

  for (const payment of input.payments) {
    if (!Number.isInteger(payment.amount) || payment.amount <= 0) {
      throw new SaleError(SaleErrorCode.INVALID_PAYMENT_AMOUNT);
    }
  }
}

function uniqueServiceIds(items: CreateSaleDto["items"]) {
  return [...new Set(items.flatMap((item) => (item.serviceId ? [item.serviceId] : [])))];
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
