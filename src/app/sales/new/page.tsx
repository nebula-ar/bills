import { PaymentMethod } from "@/generated/prisma/client";
import { SaleItemsFieldset } from "@/components/sale-items-fieldset";
import { requireAdminSession } from "@/lib/auth";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";

import { registerSale } from "./actions";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Tarjeta de débito",
  [PaymentMethod.CREDIT_CARD]: "Tarjeta de crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

type NewSalePageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const status = getSingleParam(params.status);
  const message = getSingleParam(params.message);

  const branch = await getSaleEntryOptions();
  const serviceOptions = branch?.servicePrices.map((servicePrice) => ({
    serviceId: servicePrice.serviceId,
    name: servicePrice.service.name,
    price: servicePrice.price,
  }));
  const paymentOptions = Object.values(PaymentMethod).map((method) => ({
    label: paymentMethodLabels[method],
    value: method,
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-28 pt-5 text-slate-950 sm:px-6 sm:py-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">
              Barber Bills
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Nueva venta</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
              {branch ? `${branch.business.name} · ${branch.name}` : "No hay una sucursal disponible."}
            </p>
          </div>
          <div className="flex gap-4 text-sm font-semibold text-slate-600">
            <Link className="hover:text-blue-700" href="/">
              Volver al inicio
            </Link>
            <LogoutButton />
          </div>
        </div>

        {message && isSupportedStatus(status) ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        {branch ? (
          <form action={registerSale} className="grid gap-4">
            <input name="branchId" type="hidden" value={branch.id} />

            <section className="grid gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Sucursal</p>
                <p className="mt-1 text-lg font-black text-slate-950">{branch.name}</p>
              </div>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Barbero
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 shadow-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  name="barberId"
                  required
                >
                  {branch.users.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <SaleItemsFieldset
              paymentOptions={paymentOptions}
              serviceOptions={serviceOptions ?? []}
              submitLabel="Confirmar venta"
            />
          </form>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            Ejecutá el seed o cargá una sucursal con barberos y servicios activos para registrar ventas.
          </div>
        )}
      </section>
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSupportedStatus(status: string | undefined): status is "error" | "success" {
  return status === "error" || status === "success";
}
