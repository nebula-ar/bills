import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Badge,
  DangerButton,
  EmptyState,
  Field,
  formatMoney,
  GhostButton,
  inputClass,
  PrimaryButton,
  SectionCard,
  selectClass,
} from "@/components/manager-ui";
import { MoneyInput } from "@/components/money-input";
import { AppModule, PromotionScope, PromotionType } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import {
  describeWeekdays,
  PROMOTION_SCOPE_LABELS,
  PROMOTION_TYPE_HINTS,
  PROMOTION_TYPE_LABELS,
  PROMOTION_TYPE_ORDER,
  WEEKDAYS,
} from "@/lib/promotion-labels";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { findCatalogForPromotions } from "@/modules/catalog/product.repository";
import { getPromotionsForManagement } from "@/modules/promotions/promotion.use-cases";

import { createPromotionAction, deletePromotionAction, togglePromotionAction } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "2-digit" });

type PromotionsPageProps = {
  searchParams: Promise<{ status?: string | string[]; message?: string | string[] }>;
};

export default async function PromotionsPage({ searchParams }: PromotionsPageProps) {
  const { business } = await requireModule(AppModule.PROMOTIONS);
  await searchParams;

  const [promotions, { products, categories }, branches] = await Promise.all([
    getPromotionsForManagement(business.id),
    findCatalogForPromotions(business.id),
    getBranchesForManagement(business.id),
  ]);

  const active = promotions.filter((promotion) => promotion.active);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Promociones"
        description="Se aplican solas en el momento de cobrar. Un ítem lo descuenta una sola promo: gana la de mayor prioridad."
      />

      <SectionCard
        title="Tus promociones"
        description={`${active.length} activa(s) de ${promotions.length}.`}
      >
        {promotions.length === 0 ? (
          <EmptyState
            title="Todavía no hay promociones."
            hint="Creá una abajo: 20% off, 3x2, combo a precio cerrado…"
          />
        ) : (
          <ul className="space-y-3">
            {promotions.map((promotion) => (
              <li className="rounded-2xl border border-slate-200 p-4" key={promotion.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-950">{promotion.name}</p>
                      <Badge tone={promotion.active ? "positive" : "neutral"}>
                        {promotion.active ? "Activa" : "Pausada"}
                      </Badge>
                      <Badge tone="info">{PROMOTION_TYPE_LABELS[promotion.type]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{describeRule(promotion)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {PROMOTION_SCOPE_LABELS[promotion.scope]}
                      {promotion.targets.length > 0
                        ? `: ${promotion.targets
                            .map((target) => target.product?.name ?? target.category?.name ?? "")
                            .filter(Boolean)
                            .join(", ")}`
                        : ""}
                      {" · "}
                      {describeWeekdays(promotion.weekdays)}
                      {promotion.startsAt || promotion.endsAt
                        ? ` · ${promotion.startsAt ? dateFormatter.format(promotion.startsAt) : "…"} a ${
                            promotion.endsAt ? dateFormatter.format(promotion.endsAt) : "…"
                          }`
                        : ""}
                      {promotion.branches.length > 0
                        ? ` · ${promotion.branches.map((branch) => branch.branch.name).join(", ")}`
                        : " · Todas las sucursales"}
                      {promotion._count.discounts > 0 ? ` · aplicada ${promotion._count.discounts} vez(ces)` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={togglePromotionAction}>
                      <input name="promotionId" type="hidden" value={promotion.id} />
                      <input name="active" type="hidden" value={String(!promotion.active)} />
                      <GhostButton>{promotion.active ? "Pausar" : "Activar"}</GhostButton>
                    </form>
                    <form action={deletePromotionAction}>
                      <input name="promotionId" type="hidden" value={promotion.id} />
                      <DangerButton>Eliminar</DangerButton>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Nueva promoción"
        description="Completá solo los campos del tipo que elijas; el resto se ignora."
      >
        <form action={createPromotionAction} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" className="sm:col-span-2">
              <input className={inputClass} name="name" placeholder="Martes de 20% en bebidas" required />
            </Field>

            <Field label="Tipo">
              <select className={selectClass} name="type">
                {PROMOTION_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {PROMOTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Aplica a">
              <select className={selectClass} name="scope">
                {Object.values(PromotionScope).map((scope) => (
                  <option key={scope} value={scope}>
                    {PROMOTION_SCOPE_LABELS[scope]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Parámetros por tipo</p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
              {PROMOTION_TYPE_ORDER.map((type) => (
                <li key={type}>
                  <span className="font-bold text-slate-600">{PROMOTION_TYPE_LABELS[type]}:</span>{" "}
                  {PROMOTION_TYPE_HINTS[type]}
                </li>
              ))}
            </ul>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Descuento %" hint="Solo para «Descuento %»">
                <input className={inputClass} inputMode="numeric" max={100} min={1} name="percentOff" type="number" />
              </Field>
              <Field label="Descuento fijo $" hint="Solo para «Descuento fijo»">
                <MoneyInput className={inputClass} name="fixedOff" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Llevá (N)">
                  <input className={inputClass} inputMode="numeric" name="buyQuantity" type="number" />
                </Field>
                <Field label="Pagá (M)">
                  <input className={inputClass} inputMode="numeric" name="payQuantity" type="number" />
                </Field>
              </div>
              <Field label="Precio del combo $" hint="Solo para «Combo»">
                <MoneyInput className={inputClass} name="bundlePrice" />
              </Field>
              <Field label="Compra mínima $" hint="Opcional">
                <MoneyInput className={inputClass} name="minAmount" />
              </Field>
              <Field label="Cantidad mínima" hint="Opcional">
                <input className={inputClass} inputMode="decimal" name="minQuantity" />
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Productos" hint="Para alcance «Productos elegidos» y combos">
              <select className={`${selectClass} h-32`} multiple name="productIds">
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categorías" hint="Para alcance «Categorías elegidas»">
              <select className={`${selectClass} h-32`} multiple name="categoryIds">
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Desde">
              <input className={inputClass} name="startsAt" type="date" />
            </Field>
            <Field label="Hasta">
              <input className={inputClass} name="endsAt" type="date" />
            </Field>
            <Field label="Prioridad" hint="Mayor gana ante empate">
              <input className={inputClass} defaultValue={0} inputMode="numeric" name="priority" type="number" />
            </Field>
            {branches.length > 1 ? (
              <Field label="Sucursales" hint="Vacío = todas">
                <select className={`${selectClass} h-24`} multiple name="branchIds">
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Días (ninguno = todos)
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {WEEKDAYS.map((weekday) => (
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700" key={weekday.value}>
                  <input name="weekdays" type="checkbox" value={weekday.value} />
                  {weekday.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input defaultChecked name="active" type="checkbox" />
            Activa desde ya
          </label>

          <PrimaryButton className="justify-self-start">Crear promoción</PrimaryButton>
        </form>
      </SectionCard>
    </AppShell>
  );
}

// Traduce los parámetros guardados a una frase que se entienda de un vistazo.
function describeRule(promotion: {
  type: PromotionType;
  percentOff: number | null;
  fixedOff: number | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  bundlePrice: number | null;
  minAmount: number | null;
}): string {
  const condition = promotion.minAmount ? ` (comprando ${formatMoney(promotion.minAmount)} o más)` : "";

  switch (promotion.type) {
    case PromotionType.PERCENT_OFF:
      return `${promotion.percentOff ?? 0}% de descuento${condition}`;
    case PromotionType.FIXED_OFF:
      return `${formatMoney(promotion.fixedOff ?? 0)} de descuento${condition}`;
    case PromotionType.NX_M:
      return `Llevá ${promotion.buyQuantity ?? 0}, pagá ${promotion.payQuantity ?? 0}${condition}`;
    case PromotionType.BUNDLE_PRICE:
      return `Combo a ${formatMoney(promotion.bundlePrice ?? 0)}${condition}`;
    default:
      return "";
  }
}
