import { ExpenseCategory, PaymentMethod } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findExpensesInRange(input: { businessId: string; from?: Date; to?: Date; branchId?: string | null }) {
  return prisma.expense.findMany({
    where: {
      businessId: input.businessId,
      deleted: false,
      business: { deleted: false },
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.from || input.to
        ? {
            spentAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { spentAt: "desc" },
    select: {
      id: true,
      amount: true,
      category: true,
      paymentMethod: true,
      note: true,
      spentAt: true,
      branchId: true,
      branch: {
        select: { name: true },
      },
      supplierId: true,
      supplier: {
        select: { name: true },
      },
    },
  });
}

export function findExpenseBranches(businessId: string) {
  return prisma.branch.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      business: { deleted: false },
    },
    orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      businessId: true,
      business: { select: { name: true } },
    },
  });
}

export function findExpenseBusiness() {
  return prisma.business.findFirst({
    where: { deleted: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

export function findManageableExpense(expenseId: string, businessId: string) {
  return prisma.expense.findFirst({
    where: {
      id: expenseId,
      businessId,
      deleted: false,
      business: { deleted: false },
    },
    select: { id: true },
  });
}

export function createExpense(input: {
  businessId: string;
  branchId?: string | null;
  supplierId?: string | null;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  amount: number;
  note?: string | null;
  spentAt: Date;
}) {
  return prisma.expense.create({
    data: {
      businessId: input.businessId,
      branchId: input.branchId ?? null,
      supplierId: input.supplierId ?? null,
      category: input.category,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
      note: input.note ?? null,
      spentAt: input.spentAt,
    },
  });
}

export function updateExpense(input: {
  expenseId: string;
  branchId?: string | null;
  supplierId?: string | null;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  amount: number;
  note?: string | null;
  spentAt: Date;
}) {
  return prisma.expense.update({
    where: { id: input.expenseId },
    data: {
      branchId: input.branchId ?? null,
      supplierId: input.supplierId ?? null,
      category: input.category,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
      note: input.note ?? null,
      spentAt: input.spentAt,
    },
  });
}

// Un proveedor solo se puede nombrar en un gasto si es de este negocio: el id
// llega de un <select> del navegador y de ahí no se cree nada.
export async function findUsableSupplierId(supplierId: string, businessId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, businessId, deleted: false },
    select: { id: true },
  });

  return supplier?.id ?? null;
}

export function softDeleteExpense(expenseId: string) {
  return prisma.expense.update({
    where: { id: expenseId },
    data: { deleted: true, deletedAt: new Date() },
  });
}
