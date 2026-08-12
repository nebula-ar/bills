import { PaymentMethod } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { requireBusinessContext } from "@/lib/business-context";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-labels";
import { getRecentSales, getSalesSummary } from "@/modules/sales/get-recent-sales.use-case";
import { toSalesListSale } from "@/modules/sales/recent-sales-view";
import { parsePeriodo, PERIODO_LABELS, rangoDelPeriodo } from "@/modules/sales/sales-period.logic";
import { findBusinessForInvoicing } from "@/modules/business/business.repository";
import { SalesList } from "@/components/sales-list";
import { SalesSummaryBar } from "@/components/sales-summary-bar";
import { PageEnter } from "@/components/page-enter";
import { Reveal } from "@/components/reveal";
import { loadMoreSalesAction } from "@/app/sales/actions";
import { Plus } from "@/components/icons";
import Link from "next/link";

type SalesPageProps = {
  searchParams: Promise<{ periodo?: string | string[]; metodo?: string | string[] }>;
};

/** La URL la escribe cualquiera: un medio desconocido se ignora, no rompe. */
function parseMetodo(valor: string | undefined): PaymentMethod | undefined {
  return valor && valor in PaymentMethod ? (valor as PaymentMethod) : undefined;
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const unico = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
  const periodo = parsePeriodo(unico(params.periodo));
  const metodo = parseMetodo(unico(params.metodo));
  // El "hoy" se toma acá, en el borde, y se le pasa a la lógica: así el cálculo
  // del rango se puede probar sin depender del reloj.
  const rango = rangoDelPeriodo(periodo, new Date());

  const [{ sales, nextCursor }, { totales, metodosDisponibles }, business, context] = await Promise.all([
    getRecentSales(session.user.businessId, 20, undefined, rango, metodo),
    getSalesSummary(session.user.businessId, rango, metodo),
    findBusinessForInvoicing(session.user.businessId),
    requireBusinessContext(),
  ]);
  const businessBasics = { cuit: business?.cuit ?? null, salesPointNumber: business?.salesPointNumber ?? null };
  const viewSales = sales.map((sale) => toSalesListSale(sale, businessBasics));

  return (
    <PageEnter>
      {/* Sin tope de ancho en escritorio, igual que el mostrador: el historial es
          una tabla, y una tabla encajonada en 1080px desperdicia media pantalla
          mientras la columna del detalle corta los nombres con puntos suspensivos. */}
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-slate-950 lg:max-w-none lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div>
          <p className="text-sm font-medium text-slate-500">Historial</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Ventas</h1>
        </div>
      </header>

      <Reveal>
        <SalesSummaryBar
          etiquetasDePago={PAYMENT_METHOD_LABELS}
          metodo={metodo}
          metodosDisponibles={metodosDisponibles}
          periodo={periodo}
          totales={totales}
        />

        <SalesList
        businessName={context.business.name}
        emptyHint={
          metodo
            ? `No hay ventas con ${PAYMENT_METHOD_LABELS[metodo].toLowerCase()} en «${PERIODO_LABELS[periodo].toLowerCase()}».`
            : `No hay ventas en «${PERIODO_LABELS[periodo].toLowerCase()}». Probá con otro período.`
        }
        initialCursor={nextCursor}
        loadMore={loadMoreSalesAction}
        sales={viewSales}
        // El total del período completo, para poder decir si lo que está en
        // pantalla es todo o una parte.
        totalDelPeriodo={totales.facturado}
        ventasDelPeriodo={totales.cantidad}
      />
      </Reveal>

      <Link
        aria-label="Nueva venta"
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        href="/sales/new"
      >
        <Plus className="size-6" />
      </Link>
    </main>
    </PageEnter>
  );
}
