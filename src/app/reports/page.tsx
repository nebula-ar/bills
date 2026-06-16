import { AppShell, Card, PageHeader } from "@/components/app-shell";
import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getTodaySalesReport } from "@/modules/reports/get-today-sales-report.use-case";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Tarjeta de débito",
  [PaymentMethod.CREDIT_CARD]: "Tarjeta de crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "full",
});

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string | string[];
    to?: string | string[];
    barberId?: string | string[];
    paymentMethod?: string | string[];
  }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const selectedFrom = getDateInputParam(params.from);
  const selectedTo = getDateInputParam(params.to);
  const selectedPaymentMethod = getPaymentMethodParam(params.paymentMethod);

  const report = await getTodaySalesReport({
    from: selectedFrom ? getStartOfLocalDay(selectedFrom) : undefined,
    to: selectedTo ? getEndOfLocalDay(selectedTo) : undefined,
    barberId: getSingleParam(params.barberId),
    paymentMethod: selectedPaymentMethod,
  });

  return (
    <AppShell maxWidth="lg">
        <PageHeader
          title="Reportes"
          description={getReportPeriodLabel(report.from, report.to)}
          actions={
            <>
            <Link className="text-slate-600 hover:text-blue-700" href="/sales">
              Ventas
            </Link>
            <Link className="text-slate-600 hover:text-blue-700" href="/services">
              Servicios
            </Link>
            <LogoutButton />
            </>
          }
        />

        <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" method="get">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Desde
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                defaultValue={selectedFrom ?? ""}
                name="from"
                type="date"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Hasta
              <input
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                defaultValue={selectedTo ?? ""}
                name="to"
                type="date"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Barbero
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                defaultValue={report.filters.barberId ?? ""}
                name="barberId"
              >
                <option value="">Todos</option>
                {report.options.barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Método de pago
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-950 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                defaultValue={report.filters.paymentMethod ?? ""}
                name="paymentMethod"
              >
                <option value="">Todos</option>
                {report.options.paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabels[method]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              className="rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
              type="submit"
            >
              Aplicar filtros
            </button>
            <Link
              className="rounded-2xl border border-slate-200 px-4 py-3 text-center font-bold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              href="/reports"
            >
              Limpiar
            </Link>
          </div>
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
              Total vendido
            </p>
            <p className="mt-3 text-4xl font-black text-blue-700">{formatMoney(report.totalSold)}</p>
          </Card>
          <Card>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
              Ventas
            </p>
            <p className="mt-3 text-4xl font-black text-blue-700">{report.saleCount}</p>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard title="Totales por barbero">
            {report.totalsByBarber.length === 0 ? (
              <EmptyMessage>No hay ventas de barberos para los filtros aplicados.</EmptyMessage>
            ) : (
              <ul className="space-y-3">
                {report.totalsByBarber.map((barberTotal) => (
                  <li className="flex items-center justify-between gap-4" key={barberTotal.barberId}>
                    <span>
                      {barberTotal.barberName}
                      <span className="ml-2 text-sm text-slate-400">({barberTotal.saleCount})</span>
                    </span>
                    <span className="font-bold text-slate-950">{formatMoney(barberTotal.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </ReportCard>

          <ReportCard title="Totales por método de pago">
            <ul className="space-y-3">
              {report.totalsByPaymentMethod.map((paymentTotal) => (
                <li className="flex items-center justify-between gap-4" key={paymentTotal.method}>
                  <span>{paymentMethodLabels[paymentTotal.method]}</span>
                  <span className="font-bold text-slate-950">{formatMoney(paymentTotal.total)}</span>
                </li>
              ))}
            </ul>
          </ReportCard>
        </div>

        <ReportCard title="Últimas ventas">
          {report.latestSales.length === 0 ? (
            <EmptyMessage>No hay ventas registradas para los filtros aplicados.</EmptyMessage>
          ) : (
            <div className="space-y-4">
              {report.latestSales.map((sale) => (
                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={sale.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{dateFormatter.format(sale.soldAt)}</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">{sale.branchName}</h3>
                      <p className="text-sm text-slate-500">Barbero: {sale.barberName}</p>
                    </div>
                    <p className="text-2xl font-black text-blue-700">{formatMoney(sale.total)}</p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
                        Ítems
                      </h4>
                      <ul className="mt-2 space-y-2 text-sm text-slate-600">
                        {sale.items.map((item) => (
                          <li className="flex justify-between gap-4" key={item.id}>
                            <span>
                              {item.description} x{item.quantity}
                            </span>
                            <span className="font-semibold text-slate-950">{formatMoney(item.total)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
                        Pagos
                      </h4>
                      <ul className="mt-2 space-y-2 text-sm text-slate-600">
                        {sale.payments.map((payment) => (
                          <li className="flex justify-between gap-4" key={payment.id}>
                            <span>{paymentMethodLabels[payment.method]}</span>
                          <span className="font-semibold text-slate-950">{formatMoney(payment.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ReportCard>
    </AppShell>
  );
}

function ReportCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4 text-slate-600">{children}</div>
    </article>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500">{children}</p>;
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function getSingleParam(value: string | string[] | undefined) {
  const singleValue = Array.isArray(value) ? value[0] : value;
  return singleValue === "" ? undefined : singleValue;
}

function getDateInputParam(value: string | string[] | undefined) {
  const singleValue = getSingleParam(value);

  return singleValue && /^\d{4}-\d{2}-\d{2}$/.test(singleValue) ? singleValue : undefined;
}

function getPaymentMethodParam(value: string | string[] | undefined): PaymentMethod | undefined {
  const singleValue = getSingleParam(value);

  return isPaymentMethod(singleValue) ? singleValue : undefined;
}

function isPaymentMethod(value: string | undefined): value is PaymentMethod {
  return Object.values(PaymentMethod).includes(value as PaymentMethod);
}

function getStartOfLocalDay(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getEndOfLocalDay(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function getReportPeriodLabel(from: Date | undefined, to: Date | undefined) {
  if (from && to && isSameLocalDay(from, to)) {
    return `Resumen de ventas del ${dayFormatter.format(from)}.`;
  }

  if (from && to) {
    return `Resumen de ventas desde ${dayFormatter.format(from)} hasta ${dayFormatter.format(to)}.`;
  }

  if (from) {
    return `Resumen de ventas desde ${dayFormatter.format(from)}.`;
  }

  if (to) {
    return `Resumen de ventas hasta ${dayFormatter.format(to)}.`;
  }

  return "Resumen de ventas.";
}

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
