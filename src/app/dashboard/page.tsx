import { PaymentMethod } from "@/generated/prisma/client";
import { getCurrentSession, isAdminRole } from "@/lib/auth";
import { requireBusinessContext } from "@/lib/business-context";
import { countActiveProducts } from "@/modules/catalog/product.repository";
import { DASHBOARD_RANGE_LABELS, DashboardRange, parseDashboardRange, resolveDashboardRange } from "@/lib/dashboard-range";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expense-labels";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ORDER } from "@/lib/payment-labels";
import { getExpensesSummary } from "@/modules/expenses/expense.use-cases";
import { getTodaySalesReport } from "@/modules/reports/get-today-sales-report.use-case";
import { ReportsView, type ReportsData } from "@/components/reports-view";
import { redirect } from "next/navigation";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.MERCADO_PAGO]: "Mercado Pago",
  [PaymentMethod.ACCOUNT]: "Cuenta corriente",
  [PaymentMethod.OTHER]: "Otro",
};

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Orden de lunes a domingo para el gráfico.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const trendFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric" });

type HomeProps = {
  searchParams: Promise<{
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
    staffId?: string | string[];
    paymentMethod?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await getCurrentSession();

  // Sin sesión de admin, la app arranca directo en el login (la terminal del
  // empleado se accede desde el link "Ir a la terminal" del propio login).
  if (!isAdminRole(session?.user.role)) {
    redirect("/login");
  }

  const params = await searchParams;
  const rangeKey = parseDashboardRange(params.range);
  const resolved = resolveDashboardRange(new Date(), {
    range: rangeKey,
    from: parseISODateLocal(params.from),
    to: parseISODateLocal(params.to),
  });
  const staffId = getSingleParam(params.staffId);
  const paymentMethod = getPaymentMethodParam(params.paymentMethod);

  const businessId = session.user.businessId;
  const { business } = await requireBusinessContext();
  const [report, expensesSummary, productCount] = await Promise.all([
    getTodaySalesReport({
      businessId,
      from: resolved.from,
      to: resolved.to,
      staffId,
      paymentMethod,
    }),
    getExpensesSummary({ businessId, from: resolved.from, to: resolved.to }),
    countActiveProducts(businessId),
  ]);

  const paymentTotalSum = report.totalsByPaymentMethod.reduce((sum, payment) => sum + payment.total, 0);
  const selectedStaff = report.options.staffs.find((staff) => staff.id === report.filters.staffId);

  // Cierre de caja: por cuenta (método), cuánto entró por ventas y cuánto salió por gastos.
  const incomeByMethod = new Map(report.totalsByPaymentMethod.map((payment) => [payment.method, payment.total]));
  const expenseByMethod = new Map(expensesSummary.byPaymentMethod.map((expense) => [expense.method, expense.total]));
  const accountBalances = PAYMENT_METHOD_ORDER.map((method) => {
    const income = incomeByMethod.get(method) ?? 0;
    const expense = expenseByMethod.get(method) ?? 0;
    return { key: method, label: PAYMENT_METHOD_LABELS[method], income, expense, balance: income - expense };
  }).filter((account) => account.income !== 0 || account.expense !== 0);

  const data: ReportsData = {
    catalogEmpty: productCount === 0,
    catalogPlural: business.labels.catalogPlural,
    range: {
      key: rangeKey,
      label: DASHBOARD_RANGE_LABELS[rangeKey],
      isToday: rangeKey === DashboardRange.Today,
      dateLabel: formatRangeDateLabel(resolved.from, resolved.to),
      fromValue: toISODateLocal(resolved.from),
      toValue: toISODateLocal(resolved.to),
    },
    totalSold: report.totalSold,
    saleCount: report.saleCount,
    averageTicket: report.averageTicket,
    itemsSold: report.itemsSold,
    expensesTotal: expensesSummary.total,
    net: report.totalSold - expensesSummary.total,
    expensesByCategory: expensesSummary.byCategory.map((category) => ({
      key: category.category,
      label: EXPENSE_CATEGORY_LABELS[category.category],
      total: category.total,
      percentage: expensesSummary.total > 0 ? Math.round((category.total / expensesSummary.total) * 100) : 0,
    })),
    comparison: report.comparison,
    accountBalances,
    salesTrend: report.salesByDay.map((day) => ({
      label: trendFormatter.format(parseISODateLocal(day.date) ?? new Date()),
      total: day.total,
    })),
    salesByWeekday: WEEKDAY_ORDER.map((weekday) => ({
      label: WEEKDAY_LABELS[weekday],
      total: report.salesByWeekday[weekday]?.total ?? 0,
    })),
    salesByBranch: report.salesByBranch,
    topProducts: report.topProducts,
    totalsByStaff: report.totalsByStaff,
    totalsByPayment: report.totalsByPaymentMethod
      .filter((payment) => payment.total > 0)
      .map((payment) => ({
        key: payment.method,
        label: paymentMethodLabels[payment.method],
        total: payment.total,
        percentage: paymentTotalSum > 0 ? Math.round((payment.total / paymentTotalSum) * 100) : 0,
      })),
    latestSales: report.latestSales.map((sale) => ({
      id: sale.id,
      timeLabel: timeFormatter.format(sale.soldAt),
      staffName: sale.staffName,
      branchName: sale.branchName,
      total: sale.total,
      paymentLabel: summarizePayments(sale.payments),
      itemSummary: sale.items.map((item) => `${item.description} x${item.quantity}`).join(", "),
    })),
    activeFilters: {
      staffId: report.filters.staffId,
      staffName: selectedStaff?.name,
      paymentMethod: report.filters.paymentMethod,
      paymentLabel: report.filters.paymentMethod ? paymentMethodLabels[report.filters.paymentMethod] : undefined,
    },
    staffOptions: report.options.staffs,
    paymentOptions: report.options.paymentMethods.map((method) => ({ value: method, label: paymentMethodLabels[method] })),
  };

  return <ReportsView data={data} userName={session.user.name ?? "admin"} />;
}

function summarizePayments(payments: { method: PaymentMethod }[]) {
  if (payments.length === 0) return "Sin pago";
  const methods = new Set(payments.map((payment) => payment.method));
  if (methods.size > 1) return "Mixto";
  return paymentMethodLabels[payments[0].method];
}

function getSingleParam(value: string | string[] | undefined) {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

function getPaymentMethodParam(value: string | string[] | undefined): PaymentMethod | undefined {
  const single = getSingleParam(value);
  return single && (Object.values(PaymentMethod) as string[]).includes(single) ? (single as PaymentMethod) : undefined;
}

function toISODateLocal(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODateLocal(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatRangeDateLabel(from: Date, to: Date) {
  const sameDay = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth() && from.getDate() === to.getDate();
  if (sameDay) return dayFormatter.format(from);
  return `${shortDateFormatter.format(from)} – ${shortDateFormatter.format(to)}`;
}
