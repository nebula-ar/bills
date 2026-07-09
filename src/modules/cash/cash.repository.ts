import { PaymentMethod, SaleStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type CashScope = {
  businessId: string;
  branchId?: string | null;
  from?: Date;
  to?: Date;
};

function rangeFilter(field: "soldAt" | "spentAt" | "movedAt", scope: CashScope) {
  if (!scope.from && !scope.to) return {};
  return {
    [field]: {
      ...(scope.from ? { gte: scope.from } : {}),
      ...(scope.to ? { lte: scope.to } : {}),
    },
  };
}

// Ingresos por método = pagos de ventas COMPLETADAS.
export async function findSalesIncomeByMethod(scope: CashScope) {
  const payments = await prisma.salePayment.findMany({
    where: {
      deleted: false,
      sale: {
        deleted: false,
        status: SaleStatus.COMPLETED,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        branch: { businessId: scope.businessId },
        ...rangeFilter("soldAt", scope),
      },
    },
    select: { method: true, amount: true },
  });

  return sumByKey(payments.map((p) => ({ key: p.method, amount: p.amount })));
}

// Egresos por método = gastos.
export async function findExpensesByMethod(scope: CashScope) {
  const expenses = await prisma.expense.findMany({
    where: {
      deleted: false,
      businessId: scope.businessId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...rangeFilter("spentAt", scope),
    },
    select: { paymentMethod: true, amount: true },
  });

  return sumByKey(expenses.map((e) => ({ key: e.paymentMethod, amount: e.amount })));
}

export async function findTransfers(scope: CashScope) {
  return prisma.accountTransfer.findMany({
    where: {
      deleted: false,
      businessId: scope.businessId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...rangeFilter("movedAt", scope),
    },
    orderBy: { movedAt: "desc" },
    select: { id: true, fromMethod: true, toMethod: true, amount: true, note: true, movedAt: true, branchId: true },
  });
}

export async function findOpeningBalances(businessId: string, branchId: string | null) {
  return prisma.accountOpeningBalance.findMany({
    where: { businessId, branchId: branchId ?? null },
    select: { id: true, paymentMethod: true, amount: true },
  });
}

export async function upsertOpeningBalance(input: {
  businessId: string;
  branchId: string | null;
  paymentMethod: PaymentMethod;
  amount: number;
}) {
  const existing = await prisma.accountOpeningBalance.findFirst({
    where: { businessId: input.businessId, branchId: input.branchId ?? null, paymentMethod: input.paymentMethod },
    select: { id: true },
  });

  if (existing) {
    return prisma.accountOpeningBalance.update({ where: { id: existing.id }, data: { amount: input.amount } });
  }

  return prisma.accountOpeningBalance.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId ?? null,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
    },
  });
}

export function createTransfer(input: {
  businessId: string;
  branchId: string | null;
  fromMethod: PaymentMethod;
  toMethod: PaymentMethod;
  amount: number;
  note: string | null;
  movedAt: Date;
}) {
  return prisma.accountTransfer.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId ?? null,
      fromMethod: input.fromMethod,
      toMethod: input.toMethod,
      amount: input.amount,
      note: input.note ?? null,
      movedAt: input.movedAt,
    },
  });
}

export async function softDeleteTransfer(businessId: string, transferId: string) {
  const found = await prisma.accountTransfer.findFirst({
    where: { id: transferId, businessId, deleted: false },
    select: { id: true },
  });
  if (!found) return null;
  return prisma.accountTransfer.update({ where: { id: found.id }, data: { deleted: true, deletedAt: new Date() } });
}

export function createCashClose(input: {
  businessId: string;
  branchId: string | null;
  note: string | null;
  lines: { paymentMethod: PaymentMethod; systemAmount: number; countedAmount: number }[];
}) {
  return prisma.cashClose.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId ?? null,
      note: input.note ?? null,
      lines: { create: input.lines },
    },
  });
}

export function findCashCloses(businessId: string, limit = 20) {
  return prisma.cashClose.findMany({
    where: { businessId },
    orderBy: { closedAt: "desc" },
    take: limit,
    select: {
      id: true,
      closedAt: true,
      note: true,
      branch: { select: { name: true } },
      lines: { select: { paymentMethod: true, systemAmount: true, countedAmount: true } },
    },
  });
}

function sumByKey(rows: { key: PaymentMethod; amount: number }[]) {
  const map = new Map<PaymentMethod, number>();
  for (const row of rows) {
    map.set(row.key, (map.get(row.key) ?? 0) + row.amount);
  }
  return map;
}
