import { PaymentMethod } from "@/generated/prisma/client";
import { SaleItemsFieldset } from "@/components/sale-items-fieldset";
import { getBarberSession } from "@/lib/barber-session";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { LogOut, Scissors } from "lucide-react";
import Link from "next/link";

import { lockBarberTerminal, registerBarberSale, unlockBarberTerminal } from "./actions";
import { BarberAccessPanel } from "./barber-access-panel";
import { BarberTerminalNav } from "./barber-terminal-nav";

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

  // Turno abierto: el barbero ya se identificó con PIN y hay sesión firmada vigente.
  const session = await getBarberSession();
  const sessionBarber =
    branch && session && session.branchId === branch.id && (!lockedBarberId || session.barberId === lockedBarberId)
      ? branch.users.find((barber) => barber.id === session.barberId) ?? null
      : null;

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
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-950">Nueva venta</h1>
            {branch && sessionBarber ? (
              <form action={lockBarberTerminal}>
                <input name="branchId" type="hidden" value={branch.id} />
                {lockedBarberId ? <input name="terminalBarber" type="hidden" value={lockedBarberId} /> : null}
                <button
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition active:scale-95"
                  type="submit"
                >
                  <LogOut aria-hidden="true" size={14} />
                  Salir
                </button>
              </form>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                PIN
              </span>
            )}
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

          {!branch ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
              {branchParam
                ? "Este punto de venta no está disponible. Puede que la sucursal esté inactiva o sin barberos/servicios activos. Pedile el link al administrador."
                : "Cargá una sucursal con barberos y servicios activos para registrar ventas."}
            </div>
          ) : sessionBarber ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Scissors aria-hidden="true" className="text-blue-600" size={15} />
                <span className="truncate">
                  {sessionBarber.name ?? "Barbero"} · {branch.name}
                </span>
              </div>

              <form action={registerBarberSale} className="grid gap-4">
                <input name="branchId" type="hidden" value={branch.id} />
                {lockedBarberId ? <input name="terminalBarber" type="hidden" value={lockedBarberId} /> : null}
                <SaleItemsFieldset
                  paymentOptions={paymentOptions}
                  serviceOptions={serviceOptions ?? []}
                  submitLabel="Confirmar venta"
                  variant="barberMobile"
                />
              </form>
            </div>
          ) : (
            <form action={unlockBarberTerminal} className="grid gap-5">
              <BarberAccessPanel branch={branch} lockedBarberId={lockedBarberId} />
              <button
                className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                type="submit"
              >
                Empezar turno
              </button>
            </form>
          )}

          <div className="flex flex-wrap gap-4 px-1 text-sm font-semibold text-slate-500">
            <Link className="hover:text-blue-700" href="/login">
              Administración
            </Link>
          </div>
        </div>

        <BarberTerminalNav active="sell" saleHref={selfHref} />
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
