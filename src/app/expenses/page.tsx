import { requireAdminSession } from "@/lib/auth";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/expense-labels";
import { getExpenseBranches, getExpensesInRange } from "@/modules/expenses/expense.use-cases";
import { ExpensesManager, type ExpenseRow, type ExpensesData } from "@/components/expenses-manager";

const moneyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const dayFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });

type ExpensesPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
    month?: string | string[];
  }>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const flash = getFlash(params.status, params.message);
  const now = new Date();
  const monthKey = getMonthKey(params.month, now);
  const [year, month] = monthKey.split("-").map(Number);
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const [expenses, branches] = await Promise.all([getExpensesInRange({ from, to }), getExpenseBranches()]);

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const rows: ExpenseRow[] = expenses.map((expense) => ({
    id: expense.id,
    category: expense.category,
    categoryLabel: EXPENSE_CATEGORY_LABELS[expense.category],
    branchId: expense.branchId,
    branchLabel: expense.branch ? expense.branch.name : "General",
    amount: expense.amount,
    amountLabel: moneyFormatter.format(expense.amount),
    note: expense.note,
    spentAtValue: toISODateLocal(expense.spentAt),
    dateLabel: dayFormatter.format(expense.spentAt),
  }));

  const data: ExpensesData = {
    businessName: branches[0]?.business.name ?? "Barber Bills",
    monthKey,
    monthLabel: capitalize(monthFormatter.format(from)),
    prevMonthKey: shiftMonth(monthKey, -1),
    nextMonthKey: shiftMonth(monthKey, 1),
    total,
    totalLabel: moneyFormatter.format(total),
    count: expenses.length,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    categories: EXPENSE_CATEGORIES.map((category) => ({ value: category, label: EXPENSE_CATEGORY_LABELS[category] })),
    todayValue: toISODateLocal(now),
    expenses: rows,
    flash,
  };

  return <ExpensesManager data={data} />;
}

function getMonthKey(value: string | string[] | undefined, now: Date) {
  const single = Array.isArray(value) ? value[0] : value;
  if (single && /^\d{4}-\d{2}$/.test(single)) {
    return single;
  }
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function toISODateLocal(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getFlash(
  status: string | string[] | undefined,
  message: string | string[] | undefined,
): { status: "success" | "error"; message: string } | null {
  const s = Array.isArray(status) ? status[0] : status;
  const m = Array.isArray(message) ? message[0] : message;
  if ((s === "success" || s === "error") && m) {
    return { status: s, message: m };
  }
  return null;
}
