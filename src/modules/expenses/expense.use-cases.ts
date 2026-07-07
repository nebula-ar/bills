import { ExpenseCategory } from "@/generated/prisma/client";

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
  let total = 0;

  for (const expense of expenses) {
    total += expense.amount;
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
  }

  return {
    total,
    count: expenses.length,
    byCategory: Array.from(byCategory.entries())
      .map(([category, categoryTotal]) => ({ category, total: categoryTotal }))
      .sort((a, b) => b.total - a.total),
  };
}

export async function createBusinessExpense(input: ExpenseInput) {
  validate(input);

  return createExpense({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    category: input.category,
    amount: input.amount,
    note: input.note ?? null,
    spentAt: input.spentAt,
  });
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
