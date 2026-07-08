import { PaymentMethod } from "@/generated/prisma/client";
import { BarberSaleTerminal } from "@/components/barber-sale-terminal";
import { getBarberSession } from "@/lib/barber-session";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { getActiveTerminal } from "@/modules/terminals/terminal.use-cases";
import { LogOut } from "lucide-react";
import Link from "next/link";

import { lockBarberTerminal, unlockBarberTerminal } from "./actions";
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
    terminal?: string | string[];
  }>;
};

export default async function BarberPage({ searchParams }: BarberPageProps) {
  const params = await searchParams;
  const status = getSingleParam(params.status);
  const message = getSingleParam(params.message);
  const branchParam = getSingleParam(params.branch);
  const barberParam = getSingleParam(params.barber);
  const terminalParam = getSingleParam(params.terminal);

  // Terminal personalizada: el link trae ?terminal=<id> y de ahí sale la sucursal.
  const terminal = terminalParam ? await getActiveTerminal(terminalParam) : null;
  const terminalMissing = Boolean(terminalParam) && !terminal;
  const branch = terminalMissing ? null : await getSaleEntryOptions(terminal?.branchId ?? branchParam);
  // Una terminal propia puede estar asignada a un barbero (queda fija a él) o ser tipo mostrador.
  // El "barber" del link solo aplica a los teléfonos (terminales automáticas).
  const lockedBarberId = terminal
    ? branch?.users.find((barber) => barber.id === terminal.barberId)?.id
    : branch?.users.find((barber) => barber.id === barberParam)?.id;
  const terminalId = terminal?.id;
  const selfHref = terminal
    ? `/barber?terminal=${terminal.id}`
    : branch
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
    <main className="flex min-h-[100dvh] justify-center bg-slate-100 text-slate-950 sm:px-6 sm:py-8">
      <section className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white sm:h-[calc(100dvh-4rem)] sm:rounded-[2.5rem] sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:ring-1 sm:ring-slate-200 lg:max-w-3xl">
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-950">Nueva venta</h1>
            {branch && sessionBarber ? (
              <form action={lockBarberTerminal}>
                <input name="branchId" type="hidden" value={branch.id} />
                {lockedBarberId ? <input name="terminalBarber" type="hidden" value={lockedBarberId} /> : null}
                {terminalId ? <input name="terminal" type="hidden" value={terminalId} /> : null}
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

        <div className="flex min-h-0 flex-1 flex-col">
          {message && isSupportedStatus(status) ? (
            <div className="shrink-0 px-5 pt-4">
              <p
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  status === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message}
              </p>
            </div>
          ) : null}

          {!branch ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
                {branchParam || terminalParam
                  ? "Este punto de venta no está disponible. Puede que la sucursal o la terminal estén inactivas, o sin barberos/servicios activos. Pedile el link al administrador."
                  : "Cargá una sucursal con barberos y servicios activos para registrar ventas."}
              </div>
            </div>
          ) : sessionBarber ? (
            <BarberSaleTerminal
              barberName={sessionBarber.name ?? "Barbero"}
              branchName={branch.name}
              paymentOptions={paymentOptions}
              services={serviceOptions ?? []}
              terminalName={terminal?.name ?? null}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <form action={unlockBarberTerminal} className="grid gap-5">
                <BarberAccessPanel branch={branch} lockedBarberId={lockedBarberId} />
                {terminalId ? <input name="terminal" type="hidden" value={terminalId} /> : null}
                <button
                  className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                  type="submit"
                >
                  Empezar turno
                </button>
              </form>
              <div className="mt-5 flex flex-wrap gap-4 px-1 text-sm font-semibold text-slate-500">
                <Link className="hover:text-blue-700" href="/login">
                  Administración
                </Link>
              </div>
            </div>
          )}
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
