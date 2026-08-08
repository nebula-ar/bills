import { PaymentMethod } from "@/generated/prisma/client";
import { StaffSaleTerminal } from "@/components/staff-sale-terminal";
import { readStaffFlash } from "@/lib/terminal-flash";
import { Vertical } from "@/generated/prisma/client";
import { getStaffSession } from "@/lib/terminal-session";
import { verticalPreset } from "@/lib/vertical";
import { getSaleEntryOptions } from "@/modules/sales/get-sale-entry-options.use-case";
import { getActiveTerminal } from "@/modules/terminals/terminal.use-cases";
import { LogOut } from "@/components/icons";
import Link from "next/link";

import { lockStaffTerminal, unlockStaffTerminal } from "./actions";
import { StaffAccessPanel } from "./staff-access-panel";
import { StaffTerminalNav } from "./terminal-nav";
import { StaffToast } from "./terminal-toast";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.DEBIT_CARD]: "Tarjeta de débito",
  [PaymentMethod.CREDIT_CARD]: "Tarjeta de crédito",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.MERCADO_PAGO]: "Mercado Pago",
  [PaymentMethod.ACCOUNT]: "Cuenta corriente",
  [PaymentMethod.OTHER]: "Otro",
};

type StaffPageProps = {
  searchParams: Promise<{
    branch?: string | string[];
    staff?: string | string[];
    terminal?: string | string[];
  }>;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = await searchParams;
  const flash = await readStaffFlash();
  const branchParam = getSingleParam(params.branch);
  const staffParam = getSingleParam(params.staff);
  const terminalParam = getSingleParam(params.terminal);

  // Terminal personalizada: el link trae ?terminal=<id> y de ahí sale la sucursal.
  const terminal = terminalParam ? await getActiveTerminal(terminalParam) : null;
  const terminalMissing = Boolean(terminalParam) && !terminal;
  const branch = terminalMissing ? null : await getSaleEntryOptions(terminal?.branchId ?? branchParam);
  // Una terminal propia puede estar asignada a un empleado (queda fija a él) o ser tipo mostrador.
  // El "staff" del link solo aplica a los teléfonos (terminales automáticas).
  const lockedStaffId = terminal
    ? branch?.users.find((staff) => staff.id === terminal.staffId)?.id
    : branch?.users.find((staff) => staff.id === staffParam)?.id;
  const terminalId = terminal?.id;
  const selfHref = terminal
    ? `/terminal?terminal=${terminal.id}`
    : branch
      ? `/terminal?branch=${branch.id}${lockedStaffId ? `&staff=${lockedStaffId}` : ""}`
      : "/terminal";

  // Turno abierto: el empleado ya se identificó con PIN y hay sesión firmada vigente.
  // Cómo llama el rubro a lo que vende. Sin esto la terminal de una panadería
  // hablaba de "servicios", que es de donde viene Bills y no de dónde va.
  const etiquetas = verticalPreset(branch?.business.vertical ?? Vertical.GENERAL).labels;

  const session = await getStaffSession();
  const sessionStaff =
    branch && session && session.branchId === branch.id && (!lockedStaffId || session.staffId === lockedStaffId)
      ? branch.users.find((staff) => staff.id === session.staffId) ?? null
      : null;

  const productOptions = branch?.productPrices.map((productPrice) => ({
    productId: productPrice.productId,
    name: productPrice.product.name,
    price: productPrice.price,
  }));
  const paymentOptions = Object.values(PaymentMethod).map((method) => ({
    label: paymentMethodLabels[method],
    value: method,
  }));

  return (
    <main className="flex min-h-[100dvh] justify-center bg-slate-100 text-slate-950 sm:px-6 sm:py-8">
      <section className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white sm:h-[calc(100dvh-4rem)] sm:rounded-4xl sm:shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:ring-1 sm:ring-slate-200 lg:max-w-3xl">
        {flash ? <StaffToast message={flash.message} status={flash.status} /> : null}
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-950">Nueva venta</h1>
            {branch && sessionStaff ? (
              <form action={lockStaffTerminal}>
                <input name="branchId" type="hidden" value={branch.id} />
                {lockedStaffId ? <input name="terminalStaff" type="hidden" value={lockedStaffId} /> : null}
                {terminalId ? <input name="terminal" type="hidden" value={terminalId} /> : null}
                <button
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95"
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
          {!branch ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
                {branchParam || terminalParam
                  ? "Este punto de venta no está disponible. Puede que la sucursal o la terminal estén inactivas, o sin empleados/servicios activos. Pedile el link al administrador."
                  : "Cargá una sucursal con empleados y servicios activos para registrar ventas."}
              </div>
            </div>
          ) : sessionStaff ? (
            <StaffSaleTerminal
              catalogPlural={etiquetas.catalogPlural}
              catalogSingular={etiquetas.catalogSingular}
              staffName={sessionStaff.name ?? "Empleado"}
              branchName={branch.name}
              paymentOptions={paymentOptions}
              products={productOptions ?? []}
              terminalName={terminal?.name ?? null}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 lg:flex lg:flex-col lg:justify-center">
              <form action={unlockStaffTerminal} className="mx-auto grid w-full max-w-md gap-5">
                <StaffAccessPanel branch={branch} lockedStaffId={lockedStaffId} />
                {terminalId ? <input name="terminal" type="hidden" value={terminalId} /> : null}
                <button
                  className="rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
                  type="submit"
                >
                  Empezar turno
                </button>
              </form>
              <div className="mx-auto mt-5 flex w-full max-w-md flex-wrap gap-4 px-1 text-sm font-semibold text-slate-500">
                <Link className="rounded-lg hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" href="/login">
                  Administración
                </Link>
              </div>
            </div>
          )}
        </div>

        <StaffTerminalNav active="sell" saleHref={selfHref} showCashClose={Boolean(sessionStaff?.canCloseCash)} />
      </section>
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
