import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Badge,
  EmptyState,
  formatMoney,
  GhostButton,
  SectionCard,
  StatTiles,
  type Tone,
} from "@/components/manager-ui";
import { QuoteShare } from "@/components/quote-share";
import { AppModule, QuoteStatus } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { formatQuantity } from "@/lib/quantity";
import { quoteValidity } from "@/modules/quotes/quote.logic";
import { getQuotes } from "@/modules/quotes/quote.use-cases";
import Link from "next/link";

import { deleteQuoteAction, setQuoteStatusAction } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "2-digit" });

const STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.OPEN]: "Esperando respuesta",
  [QuoteStatus.ACCEPTED]: "Aceptado",
  [QuoteStatus.REJECTED]: "Rechazado",
  [QuoteStatus.CONVERTED]: "Vendido",
};

const STATUS_TONES: Record<QuoteStatus, Tone> = {
  [QuoteStatus.OPEN]: "info",
  [QuoteStatus.ACCEPTED]: "positive",
  [QuoteStatus.REJECTED]: "danger",
  [QuoteStatus.CONVERTED]: "neutral",
};

export default async function PresupuestosPage() {
  const { business } = await requireModule(AppModule.QUOTES);

  const quotes = await getQuotes(business.id);
  const now = new Date();

  const open = quotes.filter((quote) => quote.status === QuoteStatus.OPEN);
  const converted = quotes.filter((quote) => quote.status === QuoteStatus.CONVERTED);
  // Lo que está en la calle: plata cotizada que todavía no se cobró.
  const pendingAmount = quotes
    .filter((quote) => quote.status === QuoteStatus.OPEN || quote.status === QuoteStatus.ACCEPTED)
    .reduce((sum, quote) => sum + quote.total, 0);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Presupuestos"
        description="Lo que cotizaste, hasta cuándo vale y qué se convirtió en venta."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition active:scale-95"
          href="/presupuestos/nuevo"
        >
          Nuevo presupuesto
        </Link>
      </div>

      <StatTiles
        tiles={[
          { label: "Abiertos", value: String(open.length), tone: open.length > 0 ? "info" : "neutral" },
          { label: "En la calle", value: formatMoney(pendingAmount), hint: "Cotizado sin cobrar" },
          { label: "Convertidos", value: String(converted.length), tone: converted.length > 0 ? "positive" : "neutral" },
        ]}
      />

      <SectionCard title="Todos los presupuestos" description="Del más nuevo al más viejo.">
        {quotes.length === 0 ? (
          <EmptyState
            title="Todavía no cotizaste nada."
            hint="Armá el primero y compartilo por WhatsApp: el cliente lo abre sin instalar nada."
          />
        ) : (
          <ul className="space-y-2.5">
            {quotes.map((quote) => {
              const validity = quoteValidity(quote.validUntil, now);
              const who = quote.customer?.name ?? quote.customerName ?? "Sin nombre";
              const phone = quote.customer?.phone ?? quote.customerPhone;
              const sellable = quote.status !== QuoteStatus.CONVERTED && quote.status !== QuoteStatus.REJECTED;

              return (
                <li className="rounded-2xl border border-slate-200 p-3.5" key={quote.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black text-slate-950">#{quote.number}</span>
                        <Badge tone={STATUS_TONES[quote.status]}>{STATUS_LABELS[quote.status]}</Badge>
                        {/* Vencido no bloquea: avisa. El precio de hoy es otro. */}
                        {validity.expired && quote.status !== QuoteStatus.CONVERTED ? (
                          <Badge tone="warning">Vencido</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-950">{who}</p>
                      <p className="text-xs text-slate-500">
                        Vale hasta {dateFormatter.format(quote.validUntil)}
                        {validity.expired
                          ? ` · venció hace ${Math.abs(validity.daysLeft)} ${Math.abs(validity.daysLeft) === 1 ? "día" : "días"}`
                          : validity.daysLeft === 0
                            ? " · vence hoy"
                            : ` · quedan ${validity.daysLeft} días`}
                      </p>
                      <ul className="mt-2 space-y-0.5">
                        {quote.items.map((item) => (
                          <li className="text-xs text-slate-500" key={item.id}>
                            {formatQuantity(item.quantity, item.unit)} × {item.description} ·{" "}
                            <span className="font-bold text-slate-700">{formatMoney(item.total)}</span>
                          </li>
                        ))}
                      </ul>
                      {quote.notes ? <p className="mt-1 text-xs italic text-slate-400">{quote.notes}</p> : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-2xl font-black tracking-tight text-slate-950">
                        {formatMoney(quote.total)}
                      </span>

                      <QuoteShare number={quote.number} phone={phone} token={quote.publicToken} total={quote.total} />

                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {sellable ? (
                          <Link
                            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition active:scale-95"
                            href={`/sales/new?quote=${quote.id}`}
                          >
                            Cobrar
                          </Link>
                        ) : null}

                        {quote.status === QuoteStatus.OPEN ? (
                          <>
                            <form action={setQuoteStatusAction}>
                              <input name="quoteId" type="hidden" value={quote.id} />
                              <input name="status" type="hidden" value={QuoteStatus.ACCEPTED} />
                              <GhostButton>Aceptado</GhostButton>
                            </form>
                            <form action={setQuoteStatusAction}>
                              <input name="quoteId" type="hidden" value={quote.id} />
                              <input name="status" type="hidden" value={QuoteStatus.REJECTED} />
                              <GhostButton>Rechazado</GhostButton>
                            </form>
                          </>
                        ) : null}

                        <form action={deleteQuoteAction}>
                          <input name="quoteId" type="hidden" value={quote.id} />
                          <GhostButton>Borrar</GhostButton>
                        </form>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </AppShell>
  );
}
