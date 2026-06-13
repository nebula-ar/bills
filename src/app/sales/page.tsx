import { PaymentMethod, SaleStatus } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getRecentSales } from "@/modules/sales/get-recent-sales.use-case";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";
import { cancelSaleAction } from "./actions";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Tarjeta de débito",
  [PaymentMethod.CREDIT_CARD]: "Tarjeta de crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

const saleStatusLabels: Record<SaleStatus, string> = {
  [SaleStatus.COMPLETED]: "Completada",
  [SaleStatus.CANCELLED]: "Cancelada",
};

const saleStatusClasses: Record<SaleStatus, string> = {
  [SaleStatus.COMPLETED]: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  [SaleStatus.CANCELLED]: "border-red-500/30 bg-red-500/10 text-red-300",
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

type SalesPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const flashMessage = getFlashMessage(params.status, params.message);
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
            <Link className="text-zinc-300 hover:text-zinc-50" href="/reports">
              Reportes
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/services">
              Servicios
            </Link>
            <LogoutButton />
          </div>
        </div>

        {flashMessage ? (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              flashMessage.status === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {flashMessage.message}
          </div>
        ) : null}

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
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${saleStatusClasses[sale.status]}`}>
                      {saleStatusLabels[sale.status]}
                    </span>
                    <p className="text-2xl font-bold text-amber-400">{formatMoney(sale.total)}</p>
                  </div>
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

                {sale.status === SaleStatus.COMPLETED ? (
                  <form action={cancelSaleAction} className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <input name="saleId" type="hidden" value={sale.id} />
                    <label className="grid gap-2 text-sm font-medium text-zinc-200">
                      Motivo de cancelación (opcional)
                      <textarea
                        className="min-h-20 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder:text-zinc-500"
                        maxLength={500}
                        name="reason"
                        placeholder="Ej.: carga duplicada, importe incorrecto"
                      />
                    </label>
                    <button
                      className="mt-3 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-400 hover:text-red-100"
                      type="submit"
                    >
                      Cancelar venta
                    </button>
                  </form>
                ) : null}
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

function getFlashMessage(status: string | string[] | undefined, message: string | string[] | undefined) {
  const singleStatus = getSingleParam(status);
  const singleMessage = getSingleParam(message);

  if ((singleStatus === "success" || singleStatus === "error") && singleMessage) {
    return {
      status: singleStatus,
      message: singleMessage,
    };
  }

  return null;
}

function getSingleParam(value: string | string[] | undefined) {
  const singleValue = Array.isArray(value) ? value[0] : value;
  return singleValue === "" ? undefined : singleValue;
}
