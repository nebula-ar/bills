import { PaymentMethod } from "@/generated/prisma/client";
import { SaleItemsFieldset } from "@/components/sale-items-fieldset";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { Home, Menu, ReceiptText, Scissors } from "lucide-react";
import Link from "next/link";

import { registerBarberSale } from "./actions";
import { BarberAccessPanel } from "./barber-access-panel";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Tarjeta de débito",
  [PaymentMethod.CREDIT_CARD]: "Tarjeta de crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

type BarberPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    message?: string | string[];
    branch?: string | string[];
    barber?: string | string[];
  }>;
};

export default async function BarberPage({ searchParams }: BarberPageProps) {
  const params = await searchParams;
  const status = getSingleParam(params.status);
  const message = getSingleParam(params.message);
  const branchParam = getSingleParam(params.branch);
  const barberParam = getSingleParam(params.barber);
  const branch = await getSaleEntryOptions(branchParam);
  const lockedBarberId = branch?.users.find((barber) => barber.id === barberParam)?.id;
  const selfHref = branch
    ? `/barber?branch=${branch.id}${lockedBarberId ? `&barber=${lockedBarberId}` : ""}`
    : "/barber";
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
    <main className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 sm:px-6 sm:py-8">
      <section className="mx-auto min-h-[calc(100vh-2rem)] max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] ring-1 ring-slate-200 sm:min-h-[calc(100vh-4rem)]">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2">
            <button
              aria-label="Abrir menú"
              className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700"
              type="button"
            >
              <Menu aria-hidden="true" size={20} />
            </button>
            <h1 className="text-center text-xl font-black tracking-tight text-slate-950">Nueva venta</h1>
            <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100">
              PIN requerido
            </span>
          </div>
        </div>

        <div className="grid gap-5 px-5 pb-32 pt-5">
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
          <form action={registerBarberSale} className="grid gap-4">
            <BarberAccessPanel branch={branch} lockedBarberId={lockedBarberId} />

            <SaleItemsFieldset
              paymentOptions={paymentOptions}
              serviceOptions={serviceOptions ?? []}
              submitLabel="Confirmar venta"
              variant="barberMobile"
            />
          </form>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            {branchParam
              ? "Este punto de venta no está disponible. Puede que la sucursal esté inactiva o sin barberos/servicios activos. Pedile el link al administrador."
              : "Cargá una sucursal con barberos y servicios activos para registrar ventas."}
          </div>
        )}

        <div className="flex flex-wrap gap-4 px-1 text-sm font-semibold text-slate-500">
          <Link className="hover:text-blue-700" href="/login">
            Administración
          </Link>
        </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:bottom-8 sm:rounded-b-[2.5rem]">
          <div className="grid grid-cols-3 gap-2">
            <Link className="grid place-items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-blue-50 hover:text-blue-700" href="/">
              <Home aria-hidden="true" size={18} />
              Inicio
            </Link>
            <Link className="grid place-items-center gap-1 rounded-2xl bg-blue-50 px-2 py-2 text-xs font-black text-blue-700" href={selfHref}>
              <Scissors aria-hidden="true" size={18} />
              Nueva venta
            </Link>
            <Link className="grid place-items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-blue-50 hover:text-blue-700" href="/sales">
              <ReceiptText aria-hidden="true" size={18} />
              Historial
            </Link>
          </div>
        </nav>
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
