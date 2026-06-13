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

export default async function ReportsPage() {
  await requireAdminSession();

  const report = await getTodaySalesReport();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
              Barber Bills
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Reportes</h1>
            <p className="mt-2 text-zinc-400">
              Resumen de ventas de hoy, {dayFormatter.format(report.startOfDay)}.
            </p>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link className="text-zinc-300 hover:text-zinc-50" href="/">
              Inicio
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/sales">
              Ventas
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Total vendido hoy
            </p>
            <p className="mt-3 text-4xl font-bold text-amber-400">{formatMoney(report.totalSold)}</p>
          </article>
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Ventas de hoy
            </p>
            <p className="mt-3 text-4xl font-bold text-amber-400">{report.saleCount}</p>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReportCard title="Totales por barbero">
            {report.totalsByBarber.length === 0 ? (
              <EmptyMessage>No hay ventas de barberos para hoy.</EmptyMessage>
            ) : (
              <ul className="space-y-3">
                {report.totalsByBarber.map((barberTotal) => (
                  <li className="flex items-center justify-between gap-4" key={barberTotal.barberId}>
                    <span>
                      {barberTotal.barberName}
                      <span className="ml-2 text-sm text-zinc-500">({barberTotal.saleCount})</span>
                    </span>
                    <span className="font-semibold text-zinc-100">{formatMoney(barberTotal.total)}</span>
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
                  <span className="font-semibold text-zinc-100">{formatMoney(paymentTotal.total)}</span>
                </li>
              ))}
            </ul>
          </ReportCard>
        </div>

        <ReportCard title="Últimas ventas de hoy">
          {report.latestSales.length === 0 ? (
            <EmptyMessage>Todavía no hay ventas registradas hoy.</EmptyMessage>
          ) : (
            <div className="space-y-4">
              {report.latestSales.map((sale) => (
                <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4" key={sale.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">{dateFormatter.format(sale.soldAt)}</p>
                      <h3 className="mt-1 text-lg font-semibold">{sale.branchName}</h3>
                      <p className="text-sm text-zinc-300">Barbero: {sale.barberName}</p>
                    </div>
                    <p className="text-2xl font-bold text-amber-400">{formatMoney(sale.total)}</p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Ítems
                      </h4>
                      <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                        {sale.items.map((item) => (
                          <li className="flex justify-between gap-4" key={item.id}>
                            <span>
                              {item.description} x{item.quantity}
                            </span>
                            <span className="font-medium text-zinc-100">{formatMoney(item.total)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Pagos
                      </h4>
                      <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                        {sale.payments.map((payment) => (
                          <li className="flex justify-between gap-4" key={payment.id}>
                            <span>{paymentMethodLabels[payment.method]}</span>
                            <span className="font-medium text-zinc-100">{formatMoney(payment.amount)}</span>
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
      </section>
    </main>
  );
}

function ReportCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 text-zinc-300">{children}</div>
    </article>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-400">{children}</p>;
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
