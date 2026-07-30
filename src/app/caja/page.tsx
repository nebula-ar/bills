import { requireAdminSession } from "@/lib/auth";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-labels";
import { getExpenseBranches } from "@/modules/expenses/expense.use-cases";
import { getAccountBalances, listCashCloses, listTransfers } from "@/modules/cash/cash.use-cases";
import { CashManager, type CashData } from "@/components/cash-manager";

const dayFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const shortDayFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

function toISODateLocal(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type CajaPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
    branchId?: string | string[];
  }>;
};

function single(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v !== "" ? v : undefined;
}

export default async function CajaPage({ searchParams }: CajaPageProps) {
  const session = await requireAdminSession();
  const businessId = session.user.businessId;
  const params = await searchParams;

  const branches = await getExpenseBranches(businessId);
  const branchParam = single(params.branchId);
  const selectedBranchId = branchParam && branches.some((b) => b.id === branchParam) ? branchParam : "";
  const branchId = selectedBranchId || null;

  const [balances, transfers, closes] = await Promise.all([
    getAccountBalances({ businessId, branchId }),
    listTransfers({ businessId, branchId }),
    listCashCloses(businessId),
  ]);

  const s = single(params.status);
  const m = single(params.message);
  const flash: { status: "success" | "error"; message: string } | null =
    (s === "success" || s === "error") && m ? { status: s, message: m } : null;

  const data: CashData = {
    businessName: branches[0]?.business.name ?? "Bills",
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    selectedBranchId,
    totalBalance: balances.reduce((sum, a) => sum + a.balance, 0),
    accounts: balances.map((a) => ({
      method: a.method,
      label: PAYMENT_METHOD_LABELS[a.method],
      opening: a.opening,
      income: a.income,
      expense: a.expense,
      transferIn: a.transferIn,
      transferOut: a.transferOut,
      balance: a.balance,
      hasActivity: a.opening !== 0 || a.income !== 0 || a.expense !== 0 || a.transferIn !== 0 || a.transferOut !== 0,
    })),
    paymentMethods: PAYMENT_METHOD_OPTIONS,
    transfers: transfers.map((t) => ({
      id: t.id,
      fromLabel: PAYMENT_METHOD_LABELS[t.fromMethod],
      toLabel: PAYMENT_METHOD_LABELS[t.toMethod],
      amount: t.amount,
      note: t.note,
      dateLabel: shortDayFormatter.format(t.movedAt),
    })),
    closes: closes.map((c) => {
      const totalSystem = c.lines.reduce((sum, l) => sum + l.systemAmount, 0);
      const totalCounted = c.lines.reduce((sum, l) => sum + l.countedAmount, 0);
      return {
        id: c.id,
        dateLabel: dayFormatter.format(c.closedAt),
        branchLabel: c.branch ? c.branch.name : "Todo el negocio",
        note: c.note,
        totalSystem,
        totalCounted,
        diff: totalCounted - totalSystem,
        lines: c.lines.map((l) => ({
          label: PAYMENT_METHOD_LABELS[l.paymentMethod],
          system: l.systemAmount,
          counted: l.countedAmount,
          diff: l.countedAmount - l.systemAmount,
        })),
      };
    }),
    todayValue: toISODateLocal(new Date()),
    flash,
  };

  return <CashManager data={data} />;
}
