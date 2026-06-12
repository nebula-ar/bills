import type { PaymentMethod } from "@/generated/prisma/client";

export type CreateSaleItemDto = {
  serviceId: string;
  quantity: number;
};

export type CreateSalePaymentDto = {
  method: PaymentMethod;
  amount: number;
};

export type CreateSaleDto = {
  branchId: string;
  barberId: string;
  items: CreateSaleItemDto[];
  payments: CreateSalePaymentDto[];
  notes?: string;
  soldAt?: Date;
};
