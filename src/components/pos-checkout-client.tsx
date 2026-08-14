"use client";

// Wrapper cliente del mostrador (PosCheckout) montado SOLO en el browser.
//
// Los componentes EJ2 (AutoComplete, NumericTextBox, Dialog, Toast) mutan su
// DOM de forma imperativa durante la hidratación: envuelven el <input> en un
// <span class="e-input-group"> y recolocan nodos. Cuando un hermano que React
// sí reconcilia cambia en la misma ventana de hidratación —el ícono del
// buscador, que iconify renderiza como <span> en SSR y reemplaza por <svg> al
// hidratar— React intenta insertBefore(svg, input) contra un input que ya no
// es hijo directo del div → NotFoundError → el error boundary "Algo salió mal".
//
// Es el patrón oficial de Syncfusion para App Router: sin HTML de SSR no hay
// hidratación que conflicte, y los componentes crean su DOM solo en el cliente.
// Ver NEBU-46: crash determinístico de producción reportado por Alan.
import dynamic from "next/dynamic";
import type { PosCheckoutProps } from "@/components/pos-checkout";

const PosCheckout = dynamic(() => import("@/components/pos-checkout").then((m) => m.PosCheckout), {
  ssr: false,
  loading: () => <PosCheckoutSkeleton />,
});

export function PosCheckoutClient(props: PosCheckoutProps) {
  return <PosCheckout {...props} />;
}

// Esqueleto del mostrador mientras el bundle cliente carga (el POS ya no se
// renderiza en el servidor: ver el comentario de arriba). Misma idea que el
// loading global: tarjetas pulsando para que no quede en blanco.
function PosCheckoutSkeleton() {
  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-[560px] flex-col px-4 pb-40 pt-6 text-slate-950 lg:h-screen lg:max-w-none lg:px-8 lg:pb-6">
      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_22rem] lg:items-stretch lg:gap-6">
        <div className="lg:flex lg:min-h-0 lg:flex-col">
          <div className="h-11 w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-2.5 flex gap-2">
            <div className="h-11 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="h-11 w-24 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="mt-3 grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:content-start xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                className="flex aspect-[4/5] animate-pulse rounded-lg bg-white shadow-sm ring-1 ring-slate-950/5"
                key={index}
              />
            ))}
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="flex h-full animate-pulse flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
            <div className="h-5 w-24 rounded bg-slate-200" />
            <div className="mt-6 space-y-3">
              <div className="h-4 rounded bg-slate-100" />
              <div className="h-4 w-3/4 rounded bg-slate-100" />
              <div className="h-4 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="mt-auto h-14 rounded-2xl bg-slate-200" />
          </div>
        </aside>
      </div>
    </main>
  );
}
