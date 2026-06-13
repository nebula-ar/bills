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

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  await requireAdminSession();

  const params = await searchParams;
  const status = getSingleParam(params.status);
  const message = getSingleParam(params.message);

  const branch = await getSaleEntryOptions();
  const serviceOptions = branch?.servicePrices.map((servicePrice) => ({
    serviceId: servicePrice.serviceId,
    label: `${servicePrice.service.name} · ${formatMoney(servicePrice.price)}`,
  }));

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
              Barber Bills
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Registrar venta</h1>
            <p className="mt-2 text-zinc-400">
              {branch ? `${branch.business.name} · ${branch.name}` : "No hay una sucursal disponible."}
            </p>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <Link className="text-amber-400 hover:text-amber-300" href="/">
              Volver al inicio
            </Link>
            <LogoutButton />
          </div>
        </div>

        {message && isSupportedStatus(status) ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              status === "success"
                ? "border-emerald-800 bg-emerald-950 text-emerald-200"
                : "border-red-800 bg-red-950 text-red-200"
            }`}
          >
            {message}
          </p>
        ) : null}

        {branch ? (
          <form action={registerSale} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <input name="branchId" type="hidden" value={branch.id} />

            <div className="grid gap-5">
              <label className="grid gap-2 text-sm font-medium text-zinc-200">
                Sucursal
                <input
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-300"
                  disabled
                  value={branch.name}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-zinc-200">
                Barbero
                <select
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
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

              <SaleItemsFieldset
                quantityInputClassName="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                selectClassName="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                serviceOptions={serviceOptions ?? []}
              />

              <label className="grid gap-2 text-sm font-medium text-zinc-200">
                Método de pago
                <select
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
                  name="paymentMethod"
                  required
                >
                  {Object.values(PaymentMethod).map((method) => (
                    <option key={method} value={method}>
                      {paymentMethodLabels[method]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="rounded-lg bg-amber-400 px-4 py-3 font-semibold text-zinc-950 hover:bg-amber-300"
                type="submit"
              >
                Registrar venta
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-300">
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
