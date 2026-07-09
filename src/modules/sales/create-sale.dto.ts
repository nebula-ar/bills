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
  // Venta rápida: si `payments` viene vacío y esto está seteado, createSale
  // calcula el total y crea un único pago con este método (evita recalcular
  // precios en dos capas). Si hay `payments` explícitos, esto se ignora.
  autoPaymentMethod?: PaymentMethod;
  notes?: string;
  soldAt?: Date;
};
