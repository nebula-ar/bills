"use server";

import { requireAdminSession } from "@/lib/auth";
import { parseExpenseCategory } from "@/lib/expense-labels";
import {
  createBusinessExpense,
  deleteBusinessExpense,
  updateBusinessExpense,
} from "@/modules/expenses/expense.use-cases";
import { redirect } from "next/navigation";

function parseString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function parseAmount(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

function parseSpentAt(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return new Date();
  }
  // Inicio del día local: así un gasto de "hoy" siempre queda dentro del rango
  // "Hoy" del dashboard (que va desde el inicio del día hasta el instante actual).
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

export async function createExpenseAction(formData: FormData) {
  const session = await requireAdminSession();

  const month = parseString(formData, "month") || undefined;
  const branchId = parseString(formData, "branchId") || null;
  const category = parseExpenseCategory(formData.get("category"));
  const amount = parseAmount(parseString(formData, "amount"));
  const note = parseString(formData, "note") || null;
  const spentAt = parseSpentAt(parseString(formData, "spentAt"));

  if (!category || !amount) {
    redirectWithMessage("error", "Completá categoría y un monto válido.", month);
  }

  try {
    await createBusinessExpense({ businessId: session.user.businessId, branchId, category, amount, note, spentAt });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos guardar el gasto. Intentá de nuevo.", month);
  }

  redirectWithMessage("success", "Gasto registrado.", month);
}

export async function updateExpenseAction(formData: FormData) {
  const session = await requireAdminSession();

  const month = parseString(formData, "month") || undefined;
  const expenseId = parseString(formData, "expenseId");
  const branchId = parseString(formData, "branchId") || null;
  const category = parseExpenseCategory(formData.get("category"));
  const amount = parseAmount(parseString(formData, "amount"));
  const note = parseString(formData, "note") || null;
  const spentAt = parseSpentAt(parseString(formData, "spentAt"));

  if (!expenseId || !category || !amount) {
    redirectWithMessage("error", "Completá categoría y un monto válido.", month);
  }

  try {
    await updateBusinessExpense({ businessId: session.user.businessId, expenseId, branchId, category, amount, note, spentAt });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos actualizar el gasto. Intentá de nuevo.", month);
  }

  redirectWithMessage("success", "Gasto actualizado.", month);
}

export async function deleteExpenseAction(formData: FormData) {
  const session = await requireAdminSession();

  const month = parseString(formData, "month") || undefined;
  const expenseId = parseString(formData, "expenseId");

  if (!expenseId) {
    redirectWithMessage("error", "No encontramos el gasto.", month);
  }

  try {
    await deleteBusinessExpense({ businessId: session.user.businessId, expenseId });
  } catch (error) {
    console.error(error);
    redirectWithMessage("error", "No pudimos borrar el gasto. Intentá de nuevo.", month);
  }

  redirectWithMessage("success", "Gasto borrado.", month);
}

function redirectWithMessage(status: "error" | "success", message: string, month?: string): never {
  const params = new URLSearchParams({ status, message });
  if (month) {
    params.set("month", month);
  }
  redirect(`/expenses?${params.toString()}`);
}
