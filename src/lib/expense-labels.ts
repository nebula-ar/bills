import { ExpenseCategory } from "@/generated/prisma/client";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.RENT]: "Alquiler",
  [ExpenseCategory.SALARIES]: "Sueldos",
  [ExpenseCategory.SUPPLIES]: "Insumos",
  [ExpenseCategory.UTILITIES]: "Servicios",
  [ExpenseCategory.MARKETING]: "Marketing",
  [ExpenseCategory.MAINTENANCE]: "Mantenimiento",
  [ExpenseCategory.TAXES]: "Impuestos",
  [ExpenseCategory.OTHER]: "Otros",
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.RENT,
  ExpenseCategory.SALARIES,
  ExpenseCategory.SUPPLIES,
  ExpenseCategory.UTILITIES,
  ExpenseCategory.MARKETING,
  ExpenseCategory.MAINTENANCE,
  ExpenseCategory.TAXES,
  ExpenseCategory.OTHER,
];

export function parseExpenseCategory(value: unknown): ExpenseCategory | null {
  if (typeof value === "string" && (Object.values(ExpenseCategory) as string[]).includes(value)) {
    return value as ExpenseCategory;
  }
  return null;
}
