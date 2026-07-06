import type { PaymentMethod } from "@/generated/prisma/client";

export type CreateSaleItemDto = {
  serviceId?: string | null;
  description?: string;
  quantity: number;
  unitPrice?: number;
};

export type CreateSalePaymentDto = {
  method: PaymentMethod;
  amount: number;
};

export type CreateSaleDto = {
  branchId: string;
  barberId: string;
  terminalId?: string | null;
  items: CreateSaleItemDto[];
  payments: CreateSalePaymentDto[];
  notes?: string;
  soldAt?: Date;
};
