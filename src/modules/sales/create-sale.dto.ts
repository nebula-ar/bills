import type { PaymentMethod, SaleChannel, TaxCondition, Unit } from "@/generated/prisma/client";

export type CreateSaleItemDto = {
  productId?: string | null;
  description?: string;
  // En milésimas: 1 unidad = 1000, 1,250 kg = 1250 (ver src/lib/quantity.ts).
  quantity: number;
  unitPrice?: number;
  unit?: Unit;
};

export type CreateSalePaymentDto = {
  method: PaymentMethod;
  amount: number;
};

export type CreateSaleDto = {
  branchId: string;
  staffId: string;
  terminalId?: string | null;
  // Cliente de la ficha (no confundir con `customerName`, que es el dato suelto
  // que va al comprobante). Obligatorio para cobrar en cuenta corriente.
  customerId?: string | null;
  items: CreateSaleItemDto[];
  payments: CreateSalePaymentDto[];
  // Venta rápida: si `payments` viene vacío y esto está seteado, createSale
  // calcula el total y crea un único pago con este método (evita recalcular
  // precios en dos capas). Si hay `payments` explícitos, esto se ignora.
  autoPaymentMethod?: PaymentMethod;
  notes?: string;
  soldAt?: Date;
  // Permite vender sin existencias (el kiosco que vende lo que todavía no
  // cargó). Por defecto NO: si falta stock, la venta se frena.
  allowNegativeStock?: boolean;
  userId?: string | null;
  // Datos fiscales del cliente (opcionales): sin CUIT, se factura a Consumidor
  // Final. Con CUIT + condición IVA, permite emitir factura A a una empresa.
  customerName?: string;
  customerTaxId?: string;
  customerTaxCondition?: TaxCondition;
  // Por dónde salió la venta: mostrador, para llevar o servida en una mesa.
  // Sin esto todo el salón y el mostrador se mezclan en el mismo número y no se
  // puede saber qué canal rinde. El salón ya lo guarda (ver cobrar.use-case);
  // esto lo habilita también para la venta de mostrador.
  channel?: SaleChannel;
  // Nombre, no id: el ticket tiene que seguir diciendo "Mesa 4 · Nico" aunque
  // después borren la mesa o el empleado se vaya. Un comprobante no se reescribe
  // porque cambió una ficha.
  tableName?: string | null;
  waiterName?: string | null;
};
