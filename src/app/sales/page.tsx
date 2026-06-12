import { PaymentMethod } from "@/generated/prisma/client";
import { getRecentSales } from "@/modules/sales/get-recent-sales.use-case";
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

export default async function SalesPage() {
  const sales = await getRecentSales();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
              Barber Bills
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Ventas recientes</h1>
            <p className="mt-2 text-zinc-400">
              Revisá las últimas ventas registradas para validar la carga.
            </p>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link className="text-zinc-300 hover:text-zinc-50" href="/">
              Inicio
            </Link>
            <Link className="text-amber-400 hover:text-amber-300" href="/sales/new">
              Registrar venta
            </Link>
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300">
            Todavía no hay ventas registradas. Cargá una venta para verla en este listado.
          </div>
        ) : (
          <div className="space-y-4">
            {sales.map((sale) => (
              <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5" key={sale.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">{dateFormatter.format(sale.soldAt)}</p>
                    <h2 className="mt-1 text-xl font-semibold">{sale.branchName}</h2>
                    <p className="text-sm text-zinc-300">Barbero: {sale.barberName}</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-400">{formatMoney(sale.total)}</p>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Ítems
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-300">
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
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Pagos
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-300">
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
      </section>
    </main>
  );
}

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
