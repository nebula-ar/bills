import { QuoteStatus } from "@/generated/prisma/client";
import { formatQuantity } from "@/lib/quantity";
import { quoteValidity } from "@/modules/quotes/quote.logic";
import { getPublicQuote } from "@/modules/quotes/quote.use-cases";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Vista pública del presupuesto: la abre el cliente desde el WhatsApp, sin
// cuenta. No hay sesión acá a propósito — el token random ES la credencial.
//
// Tampoco hay botones de gestión: el cliente lee, no toca. Lo que aparece es lo
// que necesita para decidir y para reclamar si el precio cambia.

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" });

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

type PublicQuotePageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PublicQuotePageProps): Promise<Metadata> {
  const { token } = await params;
  const quote = await getPublicQuote(token);

  if (!quote) return { title: "Presupuesto" };

  return {
    title: `Presupuesto #${quote.number} · ${quote.business.name}`,
    description: `Presupuesto por ${money(quote.total)}.`,
    // Un link privado no va a los buscadores.
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuotePage({ params }: PublicQuotePageProps) {
  const { token } = await params;
  const quote = await getPublicQuote(token);

  if (!quote) {
    notFound();
  }

  const validity = quoteValidity(quote.validUntil, new Date());
  const who = quote.customer?.name ?? quote.customerName;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-950/5">
        <header className="bg-slate-950 px-6 py-7 text-white">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Presupuesto</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{quote.business.name}</h1>
          <p className="mt-1 text-sm text-white/60">
            #{quote.number} · {quote.branch.name}
            {who ? ` · para ${who}` : ""}
          </p>
        </header>

        {quote.status === QuoteStatus.CONVERTED ? (
          <p className="bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600">Este presupuesto ya se facturó.</p>
        ) : validity.expired ? (
          <p className="bg-amber-50 px-6 py-3 text-sm font-bold text-amber-700">
            Venció el {dateFormatter.format(quote.validUntil)}. Consultá el precio actualizado.
          </p>
        ) : (
          <p className="bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-700">
            Válido hasta el {dateFormatter.format(quote.validUntil)}.
          </p>
        )}

        <ul className="divide-y divide-slate-100 px-6">
          {quote.items.map((item) => (
            <li className="flex items-start justify-between gap-4 py-3.5" key={item.id}>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">{item.description}</p>
                <p className="text-xs text-slate-500">
                  {formatQuantity(item.quantity, item.unit)} × {money(item.unitPrice)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-black text-slate-950">{money(item.total)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 border-t border-slate-100 px-6 py-5">
          <div className="flex items-center justify-between text-sm font-bold text-slate-500">
            <span>Subtotal</span>
            <span>{money(quote.subtotal)}</span>
          </div>
          {quote.discountTotal > 0 ? (
            <div className="flex items-center justify-between text-sm font-bold text-emerald-600">
              <span>Descuento</span>
              <span>−{money(quote.discountTotal)}</span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between pt-2">
            <span className="text-sm font-black uppercase tracking-wide text-slate-500">Total</span>
            <span className="text-3xl font-black tracking-tight text-slate-950">{money(quote.total)}</span>
          </div>
        </div>

        {quote.notes ? (
          <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">{quote.notes}</p>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">Presupuesto emitido con Bills</p>
    </main>
  );
}
