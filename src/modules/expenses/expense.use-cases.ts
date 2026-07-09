import { ExpenseCategory, PaymentMethod } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";

import {
  createExpense,
  findExpenseBranches,
  findExpensesInRange,
  findManageableExpense,
  softDeleteExpense,
  updateExpense,
} from "./expense.repository";

export type ExpenseInput = {
  businessId: string;
  branchId?: string | null;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  amount: number;
  note?: string | null;
  spentAt: Date;
};

function validate(input: { amount: number }) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
}

export async function getExpensesInRange(input: { businessId: string; from?: Date; to?: Date; branchId?: string | null }) {
  return findExpensesInRange(input);
}

export function getExpenseBranches(businessId: string) {
  return findExpenseBranches(businessId);
}

export async function getExpensesSummary(input: { businessId: string; from?: Date; to?: Date }) {
  const expenses = await findExpensesInRange(input);
  const byCategory = new Map<ExpenseCategory, number>();
  const byPaymentMethod = new Map<PaymentMethod, number>();
  let total = 0;

  for (const expense of expenses) {
    total += expense.amount;
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
    byPaymentMethod.set(expense.paymentMethod, (byPaymentMethod.get(expense.paymentMethod) ?? 0) + expense.amount);
  }

  return {
    total,
    count: expenses.length,
    byCategory: Array.from(byCategory.entries())
      .map(([category, categoryTotal]) => ({ category, total: categoryTotal }))
      .sort((a, b) => b.total - a.total),
    byPaymentMethod: Array.from(byPaymentMethod.entries()).map(([method, methodTotal]) => ({ method, total: methodTotal })),
  };
}

export async function createBusinessExpense(input: ExpenseInput) {
  validate(input);

  const expense = await createExpense({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    category: input.category,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
    note: input.note ?? null,
    spentAt: input.spentAt,
  });

  await logEvent("expense.create", `Gasto de $${input.amount} (${input.category})`, {
    businessId: input.businessId,
    context: {
      expenseId: expense.id,
      branchId: input.branchId ?? null,
      category: input.category,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
    },
  });

  return expense;
}

export async function updateBusinessExpense(input: ExpenseInput & { expenseId: string }) {
  validate(input);

  const expense = await findManageableExpense(input.expenseId, input.businessId);
  if (!expense) {
    throw new Error("EXPENSE_NOT_FOUND");
  }

  return updateExpense({
    expenseId: expense.id,
    branchId: input.branchId ?? null,
    category: input.category,
    paymentMethod: input.paymentMethod,
    amount: input.amount,
    note: input.note ?? null,
    spentAt: input.spentAt,
  });
}

export async function deleteBusinessExpense(input: { businessId: string; expenseId: string }) {
  const expense = await findManageableExpense(input.expenseId, input.businessId);
  if (!expense) {
    throw new Error("EXPENSE_NOT_FOUND");
  }

  return softDeleteExpense(expense.id);
}
