import type { Prisma } from "@/generated/prisma/client";
import { CustomerAccountEntryType, PaymentMethod, SaleStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type Tx = Prisma.TransactionClient;

// El saldo de un cliente es la suma de su libro: cargos (fiado) menos pagos.
// Se calcula siempre, nunca se guarda: un contador desnormalizado que se
// desincroniza es peor que una suma.
export async function findCustomerBalances(businessId: string) {
  const grouped = await prisma.customerAccountEntry.groupBy({
    by: ["customerId"],
    where: { customer: { businessId, deleted: false } },
    _sum: { amount: true },
  });

  return new Map(grouped.map((row) => [row.customerId, row._sum.amount ?? 0]));
}

export async function findCustomerBalance(customerId: string) {
  const result = await prisma.customerAccountEntry.aggregate({
    where: { customerId },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

export function findCustomersForManagement(businessId: string) {
  return prisma.customer.findMany({
    where: { businessId, deleted: false },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      taxId: true,
      taxCondition: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      creditLimit: true,
      birthday: true,
      active: true,
      _count: { select: { sales: true } },
    },
  });
}

// Clientes elegibles para cobrar a cuenta en el POS: activos y con su saldo,
// para poder frenar al que ya se pasó del límite.
export function findCustomersForSale(businessId: string) {
  return prisma.customer.findMany({
    where: { businessId, deleted: false, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, taxId: true, taxCondition: true, creditLimit: true },
  });
}

export function findCustomerById(customerId: string, businessId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, businessId, deleted: false },
    select: {
      id: true,
      name: true,
      taxId: true,
      taxCondition: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      creditLimit: true,
      birthday: true,
      active: true,
    },
  });
}

export function findCustomerAccountEntries(customerId: string, limit = 100) {
  return prisma.customerAccountEntry.findMany({
    where: { customerId },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      method: true,
      note: true,
      occurredAt: true,
      sale: { select: { id: true, total: true, soldAt: true } },
    },
  });
}

export function findCustomerSales(customerId: string, limit = 30) {
  return prisma.sale.findMany({
    where: { customerId, deleted: false, status: SaleStatus.COMPLETED },
    orderBy: { soldAt: "desc" },
    take: limit,
    select: {
      id: true,
      soldAt: true,
      total: true,
      branch: { select: { name: true } },
      items: { where: { deleted: false }, select: { description: true, quantity: true } },
    },
  });
}

export type CustomerWriteInput = {
  businessId: string;
  name: string;
  taxId: string | null;
  taxCondition: Prisma.CustomerCreateInput["taxCondition"];
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  creditLimit: number | null;
  birthday?: Date | null;
  active: boolean;
  userId?: string | null;
};

export function createCustomerRecord(input: CustomerWriteInput) {
  return prisma.customer.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      taxId: input.taxId,
      taxCondition: input.taxCondition,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
      creditLimit: input.creditLimit,
      birthday: input.birthday ?? null,
      active: input.active,
      createdById: input.userId,
      updatedById: input.userId,
    },
  });
}

export function updateCustomerRecord(customerId: string, input: CustomerWriteInput) {
  return prisma.customer.update({
    where: { id: customerId },
    data: {
      name: input.name,
      taxId: input.taxId,
      taxCondition: input.taxCondition,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
      creditLimit: input.creditLimit,
      birthday: input.birthday ?? null,
      active: input.active,
      updatedById: input.userId,
    },
  });
}

export function softDeleteCustomer(customerId: string, userId?: string | null) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { deleted: true, deletedAt: new Date(), deletedById: userId, active: false },
  });
}

// Cargo por venta fiada. Se asienta dentro de la transacción de la venta: si la
// venta no se graba, la deuda tampoco existe.
export function chargeCustomerAccount(
  tx: Tx,
  input: {
    customerId: string;
    branchId: string | null;
    amount: number;
    saleId: string;
    occurredAt?: Date;
    userId?: string | null;
  },
) {
  return tx.customerAccountEntry.create({
    data: {
      customerId: input.customerId,
      branchId: input.branchId,
      type: CustomerAccountEntryType.CHARGE,
      amount: input.amount,
      saleId: input.saleId,
      occurredAt: input.occurredAt,
      note: "Venta a cuenta",
      createdById: input.userId,
    },
  });
}

// Reversa del cargo al anular la venta. No se borra el asiento original: se
// compensa, para que el libro siga contando toda la historia.
export function reverseCustomerCharge(
  tx: Tx,
  input: { customerId: string; branchId: string | null; amount: number; saleId: string; userId?: string | null },
) {
  return tx.customerAccountEntry.create({
    data: {
      customerId: input.customerId,
      branchId: input.branchId,
      type: CustomerAccountEntryType.ADJUSTMENT,
      amount: -input.amount,
      saleId: input.saleId,
      note: "Anulación de venta a cuenta",
      createdById: input.userId,
    },
  });
}

export function createCustomerPayment(input: {
  customerId: string;
  branchId: string | null;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  occurredAt?: Date;
  userId?: string | null;
}) {
  return prisma.customerAccountEntry.create({
    data: {
      customerId: input.customerId,
      branchId: input.branchId,
      type: CustomerAccountEntryType.PAYMENT,
      // Negativo: un pago baja la deuda.
      amount: -input.amount,
      method: input.method,
      note: input.note,
      occurredAt: input.occurredAt,
      createdById: input.userId,
    },
  });
}

// Cobros de cuenta corriente por método, para que la caja los cuente como
// ingreso real (el fiado entra a la caja recién cuando el cliente lo paga).
export async function findCustomerPaymentsByMethod(scope: {
  businessId: string;
  branchId?: string | null;
  from?: Date;
  to?: Date;
}) {
  const grouped = await prisma.customerAccountEntry.groupBy({
    by: ["method"],
    where: {
      type: CustomerAccountEntryType.PAYMENT,
      customer: { businessId: scope.businessId, deleted: false },
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(scope.from || scope.to
        ? {
            occurredAt: {
              ...(scope.from ? { gte: scope.from } : {}),
              ...(scope.to ? { lte: scope.to } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });

  // Los pagos están guardados en negativo (bajan la deuda); para la caja son
  // un ingreso positivo.
  return new Map<PaymentMethod, number>(
    grouped.flatMap((row) => (row.method ? [[row.method, Math.abs(row._sum.amount ?? 0)] as const] : [])),
  );
}
