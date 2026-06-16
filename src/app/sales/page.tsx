import { AppShell, Card, PageHeader } from "@/components/app-shell";
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
  [SaleStatus.COMPLETED]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [SaleStatus.CANCELLED]: "border-red-200 bg-red-50 text-red-700",
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
    <AppShell maxWidth="md">
        <PageHeader
          title="Ventas recientes"
          description="Revisá las últimas ventas registradas para validar la carga."
          actions={
            <>
            <Link className="text-slate-600 hover:text-blue-700" href="/reports">
                Reportes
              </Link>
              <Link className="rounded-2xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-700" href="/sales/new">
                Registrar venta
              </Link>
            <LogoutButton />
            </>
          }
        />

        {flashMessage ? (
          <div
            className={`rounded-2xl border p-4 text-sm font-semibold ${
              flashMessage.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {flashMessage.message}
          </div>
        ) : null}

        {sales.length === 0 ? (
          <Card className="text-slate-600">
            Todavía no hay ventas registradas. Cargá una venta para verla en este listado.
          </Card>
        ) : (
          <div className="space-y-4">
            {sales.map((sale) => (
              <Card key={sale.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{dateFormatter.format(sale.soldAt)}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{sale.branchName}</h2>
                    <p className="text-sm text-slate-500">Barbero: {sale.barberName}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${saleStatusClasses[sale.status]}`}>
                      {saleStatusLabels[sale.status]}
                    </span>
                    <p className="text-2xl font-black text-blue-700">{formatMoney(sale.total)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
                      Ítems
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
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
                    <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
                      Pagos
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {sale.payments.map((payment) => (
                        <li className="flex justify-between gap-4" key={payment.id}>
                          <span>{paymentMethodLabels[payment.method]}</span>
                          <span className="font-semibold text-slate-950">{formatMoney(payment.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {sale.status === SaleStatus.COMPLETED ? (
                  <form action={cancelSaleAction} className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <input name="saleId" type="hidden" value={sale.id} />
                    <label className="grid gap-2 text-sm font-semibold text-slate-700">
                      Motivo de cancelación (opcional)
                      <textarea
                        className="min-h-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-950 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        maxLength={500}
                        name="reason"
                        placeholder="Ej.: carga duplicada, importe incorrecto"
                      />
                    </label>
                    <button
                      className="mt-3 rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
                      type="submit"
                    >
                      Cancelar venta
                    </button>
                  </form>
                ) : null}
              </Card>
            ))}
          </div>
        )}
    </AppShell>
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
