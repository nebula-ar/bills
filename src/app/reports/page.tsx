import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { DASHBOARD_RANGE_LABELS, DashboardRange, parseDashboardRange, resolveDashboardRange } from "@/lib/dashboard-range";
import { getTodaySalesReport } from "@/modules/reports/get-today-sales-report.use-case";
import { ReportsView, type ReportsData } from "@/components/reports-view";

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

type ReportsPageProps = {
  searchParams: Promise<{
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
    barberId?: string | string[];
    paymentMethod?: string | string[];
  }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const rangeKey = parseDashboardRange(params.range);
  const resolved = resolveDashboardRange(new Date(), {
    range: rangeKey,
    from: parseISODateLocal(params.from),
    to: parseISODateLocal(params.to),
  });
  const barberId = getSingleParam(params.barberId);
  const paymentMethod = getPaymentMethodParam(params.paymentMethod);

  const report = await getTodaySalesReport({
    from: resolved.from,
    to: resolved.to,
    barberId,
    paymentMethod,
  });

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

  return <ReportsView data={data} />;
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
