import { PaymentMethod } from "@/generated/prisma/client";
import { getCurrentSession, isAdminRole } from "@/lib/auth";
import { DASHBOARD_RANGE_LABELS, DashboardRange, parseDashboardRange, resolveDashboardRange } from "@/lib/dashboard-range";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expense-labels";
import { getExpensesSummary } from "@/modules/expenses/expense.use-cases";
import { getTodaySalesReport } from "@/modules/reports/get-today-sales-report.use-case";
import { ReportsView, type ReportsData } from "@/components/reports-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Orden de lunes a domingo para el gráfico.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const timeFormatter = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const shortDateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const trendFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric" });

type HomeProps = {
  searchParams: Promise<{
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
    barberId?: string | string[];
    paymentMethod?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await getCurrentSession();

  if (!isAdminRole(session?.user.role)) {
    return <AccessPage />;
  }

  const params = await searchParams;
  const rangeKey = parseDashboardRange(params.range);
  const resolved = resolveDashboardRange(new Date(), {
    range: rangeKey,
    from: parseISODateLocal(params.from),
    to: parseISODateLocal(params.to),
  });
  const barberId = getSingleParam(params.barberId);
  const paymentMethod = getPaymentMethodParam(params.paymentMethod);

  const businessId = session.user.businessId;
  const [report, expensesSummary] = await Promise.all([
    getTodaySalesReport({
      businessId,
      from: resolved.from,
      to: resolved.to,
      barberId,
      paymentMethod,
    }),
    getExpensesSummary({ businessId, from: resolved.from, to: resolved.to }),
  ]);

  const paymentTotalSum = report.totalsByPaymentMethod.reduce((sum, payment) => sum + payment.total, 0);
  const selectedBarber = report.options.barbers.find((barber) => barber.id === report.filters.barberId);

  const data: ReportsData = {
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
    salesTrend: report.salesByDay.map((day) => ({
      label: trendFormatter.format(parseISODateLocal(day.date) ?? new Date()),
      total: day.total,
    })),
    salesByWeekday: WEEKDAY_ORDER.map((weekday) => ({
      label: WEEKDAY_LABELS[weekday],
      total: report.salesByWeekday[weekday]?.total ?? 0,
    })),
    salesByBranch: report.salesByBranch,
    topServices: report.topServices,
    totalsByBarber: report.totalsByBarber,
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
      barberName: sale.barberName,
      branchName: sale.branchName,
      total: sale.total,
      paymentLabel: summarizePayments(sale.payments),
      itemSummary: sale.items.map((item) => `${item.description} x${item.quantity}`).join(", "),
    })),
    activeFilters: {
      barberId: report.filters.barberId,
      barberName: selectedBarber?.name,
      paymentMethod: report.filters.paymentMethod,
      paymentLabel: report.filters.paymentMethod ? paymentMethodLabels[report.filters.paymentMethod] : undefined,
    },
    barberOptions: report.options.barbers,
    paymentOptions: report.options.paymentMethods.map((method) => ({ value: method, label: paymentMethodLabels[method] })),
  };

  return <ReportsView data={data} userName={session.user.name ?? "admin"} />;
}

function AccessPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col justify-center">
        <Badge className="w-fit border-blue-100 bg-blue-50 text-blue-700" variant="outline">
          Barber Bills
        </Badge>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Administrá la barbería sin perder el pulso del día.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Ingresá como administrador para ver el panel de ventas, reportes y rendimiento. Si sos barbero, usá la terminal de carga rápida.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700" size="lg">
            <Link href="/login">Ingresar como administrador</Link>
          </Button>
          <Button asChild className="rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100" size="lg" variant="outline">
            <Link href="/barber">Ir a la terminal</Link>
          </Button>
        </div>
      </section>
    </main>
  );
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
