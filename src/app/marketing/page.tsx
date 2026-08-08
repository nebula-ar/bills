import { AppShell, PageHeader } from "@/components/app-shell";
import { MarketingPublicLink } from "@/components/marketing-public-link";
import { MarketingSettingsForm } from "@/components/marketing-settings-form";
import {
  Badge,
  EmptyState,
  formatMoney,
  SectionCard,
  StatTiles,
} from "@/components/manager-ui";
import { WhatsappButton } from "@/components/whatsapp-button";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { verticalFeatures } from "@/lib/vertical";
import {
  birthdayMessage,
  campaignMessage,
  loyaltyMessage,
  reviewMessage,
  winBackMessage,
  DEFAULT_LAPSED_DAYS,
} from "@/modules/marketing/marketing.logic";
import { loyaltyEnabled, pointsValue } from "@/modules/marketing/loyalty.logic";
import { getMarketingOverview, getMarketingSettings } from "@/modules/marketing/marketing.use-cases";
import Link from "next/link";


const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" });

type MarketingPageProps = {
  searchParams: Promise<{
    dias?: string | string[];
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function MarketingPage({ searchParams }: MarketingPageProps) {
  const { business } = await requireModule(AppModule.MARKETING);

  const params = await searchParams;
  const lapsedDays = parseDays(single(params.dias));
  const now = new Date();

  const [overview, settings] = await Promise.all([
    getMarketingOverview({ businessId: business.id, now, lapsedDays }),
    getMarketingSettings(business.id),
  ]);

  const features = verticalFeatures(business.vertical);
  const rules = { pointsPerAmount: settings?.pointsPerAmount ?? null, pointValue: settings?.pointValue ?? null };
  const puntosActivos = loyaltyEnabled(rules);
  const conPuntos = overview.customers
    .map((customer) => ({ ...customer, points: overview.loyaltyBalances.get(customer.id) ?? 0 }))
    .filter((customer) => customer.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Marketing"
        description="Los datos que ya tenés, usados para que el cliente vuelva."
      />

      <StatTiles
        tiles={[
          {
            label: "Se están yendo",
            value: String(overview.lapsed.length),
            hint: `Sin comprar hace ${lapsedDays}+ días`,
            tone: overview.lapsed.length > 0 ? "warning" : "positive",
          },
          {
            label: "Cumplen este mes",
            value: String(overview.birthdays.length),
            tone: overview.birthdays.length > 0 ? "info" : "neutral",
          },
          {
            label: "Clientes activos",
            value: String(overview.customers.filter((customer) => customer.purchaseCount > 0).length),
          },
        ]}
      />

      {/* ── Recuperar clientes ─────────────────────────────────────────────── */}
      <SectionCard
        title="Clientes que no vuelven"
        description="Del que hace más tiempo que no viene al que menos. Recuperar a uno que ya te conoce es mucho más fácil que conseguir uno nuevo."
        actions={
          <div className="flex items-center gap-1">
            {[30, 45, 60, 90].map((days) => (
              <Link
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  days === lapsedDays ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
                href={`/marketing?dias=${days}`}
                key={days}
              >
                {days}d
              </Link>
            ))}
          </div>
        }
      >
        {overview.lapsed.length === 0 ? (
          <EmptyState
            title="Nadie se está yendo."
            hint={`Ningún cliente lleva más de ${lapsedDays} días sin comprar.`}
          />
        ) : (
          <ul className="space-y-2.5">
            {overview.lapsed.slice(0, 20).map((customer) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3.5" key={customer.id}>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">{customer.name}</p>
                  <p className="text-xs text-slate-500">
                    Hace {customer.daysAway} días · {customer.purchaseCount} compras ·{" "}
                    {formatMoney(customer.totalSpent)}
                  </p>
                </div>
                <WhatsappButton
                  label="Escribirle"
                  message={winBackMessage({
                    businessName: business.name,
                    customerName: customer.name,
                    daysAway: customer.daysAway,
                  })}
                  phone={customer.phone}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── Cumpleaños ─────────────────────────────────────────────────────── */}
      <SectionCard title="Cumpleaños del mes" description="Saludar cuesta nada y se acuerdan.">
        {overview.birthdays.length === 0 ? (
          <EmptyState
            title="Nadie cumple este mes."
            hint="Cargá la fecha en la ficha del cliente para que aparezca acá."
          />
        ) : (
          <ul className="space-y-2.5">
            {overview.birthdays.map((customer) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3.5" key={customer.id}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-black text-slate-950">
                    {customer.name}
                    {customer.turnsToday ? <Badge tone="positive">Hoy</Badge> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {customer.birthday ? dateFormatter.format(customer.birthday) : ""}
                  </p>
                </div>
                <WhatsappButton
                  label="Saludar"
                  message={birthdayMessage({ businessName: business.name, customerName: customer.name })}
                  phone={customer.phone}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── Mejores clientes ───────────────────────────────────────────────── */}
      <SectionCard title="Tus mejores clientes" description="A los que conviene avisarles primero cuando llega algo bueno.">
        {overview.top.length === 0 ? (
          <EmptyState title="Todavía no hay ventas con cliente." hint="Elegí el cliente al cobrar para verlo acá." />
        ) : (
          <ul className="space-y-2.5">
            {overview.top.map((customer, index) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3.5" key={customer.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{customer.name}</p>
                    <p className="text-xs text-slate-500">
                      {customer.purchaseCount} compras · {formatMoney(customer.totalSpent)}
                    </p>
                  </div>
                </div>
                <WhatsappButton
                  label="Avisarle"
                  message={campaignMessage({
                    businessName: business.name,
                    customerName: customer.name,
                    body: "Nos llegó mercadería nueva y quisimos avisarte a vos primero.",
                  })}
                  phone={customer.phone}
                  tone="ghost"
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── Se venden juntos ───────────────────────────────────────────────── */}
      <SectionCard
        title="Se venden juntos"
        description="Lo que tus clientes se llevan en el mismo ticket, de los últimos 3 meses. Un combo con esto se vende solo."
        actions={
          business.has(AppModule.PROMOTIONS) ? (
            <Link className="text-xs font-bold text-primary hover:underline" href="/promotions">
              Crear combo
            </Link>
          ) : null
        }
      >
        {overview.pairs.length === 0 ? (
          <EmptyState
            title="Todavía no hay un patrón claro."
            hint="Hacen falta unas cuantas ventas con más de un ítem para que esto diga algo."
          />
        ) : (
          <ul className="space-y-2.5">
            {overview.pairs.map((pair) => (
              <li className="rounded-2xl border border-slate-200 p-3.5" key={`${pair.a}-${pair.b}`}>
                <p className="text-sm font-black text-slate-950">
                  {pair.a} + {pair.b}
                </p>
                <p className="text-xs text-slate-500">
                  Juntos en {pair.together} ventas · {pair.confidence}% de las veces que se llevaron el más vendido
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── Puntos ─────────────────────────────────────────────────────────── */}
      <SectionCard
        title="Puntos"
        description={
          puntosActivos
            ? `Cada ${formatMoney(rules.pointsPerAmount ?? 0)} de compra suma 1 punto, y cada punto vale ${formatMoney(rules.pointValue ?? 0)}.`
            : "Configurá el programa abajo y los puntos empiezan a sumarse solos en cada venta."
        }
      >
        {!puntosActivos ? (
          <EmptyState title="El programa está apagado." hint="Se prende con los dos valores de la configuración." />
        ) : conPuntos.length === 0 ? (
          <EmptyState title="Todavía nadie juntó puntos." hint="Se suman al cobrar, si la venta tiene cliente." />
        ) : (
          <ul className="space-y-2.5">
            {conPuntos.map((customer) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3.5" key={customer.id}>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">{customer.name}</p>
                  <p className="text-xs text-slate-500">
                    {customer.points} puntos · {formatMoney(pointsValue(customer.points, rules))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <WhatsappButton
                    label="Avisarle"
                    message={loyaltyMessage({
                      businessName: business.name,
                      customerName: customer.name,
                      points: customer.points,
                      value: pointsValue(customer.points, rules),
                    })}
                    phone={customer.phone}
                    tone="ghost"
                  />
                  <Link
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
                    href={`/customers?customerId=${customer.id}`}
                  >
                    Ver ficha
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── Reseñas ────────────────────────────────────────────────────────── */}
      {settings?.googleReviewUrl ? (
        <SectionCard
          title="Pedir reseñas"
          description="A los que compraron hace poco. Una reseña en Google es lo que hace que te encuentre el que todavía no te conoce."
        >
          <ul className="space-y-2.5">
            {overview.customers
              .filter((customer) => customer.lastPurchaseAt !== null)
              .sort((a, b) => (b.lastPurchaseAt as Date).getTime() - (a.lastPurchaseAt as Date).getTime())
              .slice(0, 8)
              .map((customer) => (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3.5" key={customer.id}>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{customer.name}</p>
                    <p className="text-xs text-slate-500">
                      Compró el {customer.lastPurchaseAt ? dateFormatter.format(customer.lastPurchaseAt) : ""}
                    </p>
                  </div>
                  <WhatsappButton
                    label="Pedir reseña"
                    message={reviewMessage({
                      businessName: business.name,
                      customerName: customer.name,
                      url: settings.googleReviewUrl as string,
                    })}
                    phone={customer.phone}
                    tone="ghost"
                  />
                </li>
              ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* ── Página pública ─────────────────────────────────────────────────── */}
      {features.publicPage ? (
        <SectionCard
          title="Tu página pública"
          description={
            features.publicPage === "booking"
              ? "El link para que tus clientes reserven turno solos, sin llamarte. Va en el Instagram o en el estado de WhatsApp."
              : "El link con tu catálogo y precios, para compartir por WhatsApp o Instagram. El cliente arma el pedido y te llega por WhatsApp."
          }
        >
          <MarketingPublicLink
            active={settings?.publicPageActive ?? false}
            businessName={business.name}
            kind={features.publicPage}
            token={settings?.publicToken ?? null}
          />
        </SectionCard>
      ) : null}

      {/* ── Configuración ──────────────────────────────────────────────────── */}
      <SectionCard title="Configuración" description="Todo esto se puede cambiar cuando quieras.">
        <MarketingSettingsForm
          googleReviewUrl={settings?.googleReviewUrl ?? null}
          pointsPerAmount={settings?.pointsPerAmount ?? null}
          pointValue={settings?.pointValue ?? null}
          publicNote={settings?.publicNote ?? null}
          publicPageActive={settings?.publicPageActive ?? false}
          showPublicPage={Boolean(features.publicPage)}
        />

        <p className="mt-3 text-xs text-slate-500">
          Los mensajes se mandan desde tu WhatsApp, de a uno. No hay envío masivo automático a propósito: mandar
          doscientos mensajes de golpe es la forma más rápida de que te bloqueen el número.
        </p>
      </SectionCard>
    </AppShell>
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}

function parseDays(value: string | undefined): number {
  const parsed = Number(value);
  return [30, 45, 60, 90].includes(parsed) ? parsed : DEFAULT_LAPSED_DAYS;
}
