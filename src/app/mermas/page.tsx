import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Badge,
  EmptyState,
  Field,
  formatMoney,
  inputClass,
  PrimaryButton,
  SectionCard,
  selectClass,
} from "@/components/manager-ui";
import { AppModule, ProductKind } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { formatQuantity, unitShort } from "@/lib/quantity";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { findMermas, findTodoLoQueSePuedeTirar } from "@/modules/tables/recipes.repository";

import { registrarMermaAction } from "./actions";

/**
 * Lo que se tira, y por qué.
 *
 * Es una de las tres puntas que casi nunca se anotan y son las que más se comen
 * el margen. Sirve para producto terminado y para insumo: las dos cosas son un
 * Product, así que alcanza una sola pantalla.
 *
 * El motivo es obligatorio a propósito. Una merma sin motivo es un número que
 * nadie puede accionar: "se tiraron 3 kg" no dice si hay que comprar mejor,
 * producir menos o revisar la heladera.
 */

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const fecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type MermasPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    estado?: string | string[];
    mensaje?: string | string[];
  }>;
};

export default async function MermasPage({ searchParams }: MermasPageProps) {
  const { session } = await requireModule(AppModule.RECIPES);
  const params = await searchParams;

  const sucursales = await getBranchesForManagement(session.user.businessId);
  const branchId = uno(params.branchId) || sucursales[0]?.id || "";

  const [productos, mermas] = await Promise.all([
    findTodoLoQueSePuedeTirar(session.user.businessId),
    branchId ? findMermas(session.user.businessId, branchId) : Promise.resolve([]),
  ]);

  // Lo que costó lo tirado: es el número que duele y el que hace que se anote.
  const perdido = mermas.reduce(
    (suma, m) => suma + Math.round(((m.product.cost ?? 0) * m.quantity) / 1000),
    0,
  );

  const mensaje = uno(params.mensaje);
  const estado = uno(params.estado);

  return (
    <AppShell>
      <PageHeader title="Mermas" description="Lo quemado, roto o vencido. Y cuánto costó." />

      {mensaje ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            estado === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </p>
      ) : null}

      <SectionCard title="Anotar una merma" description="Producto terminado o insumo, lo que sea.">
        <form action={registrarMermaAction} className="flex flex-wrap items-end gap-3">
          <input name="branchId" type="hidden" value={branchId} />
          <Field label="Qué se tiró">
            <select className={selectClass} name="productId">
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.kind === ProductKind.INGREDIENT ? " (insumo)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cuánto">
            <input className={inputClass} inputMode="decimal" name="cantidad" placeholder="2" required />
          </Field>
          <Field label="Por qué">
            <input className={inputClass} maxLength={80} name="motivo" placeholder="Se quemó" required />
          </Field>
          <PrimaryButton>Anotar</PrimaryButton>
        </form>
      </SectionCard>

      <SectionCard
        title="Últimas mermas"
        description={perdido > 0 ? `${formatMoney(perdido)} tirados en lo que se ve acá` : "Nada anotado todavía"}
      >
        {mermas.length === 0 ? (
          <EmptyState
            title="Sin mermas anotadas"
            hint="Anotar lo que se tira es lo que después explica a dónde se fue el margen."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {mermas.map((m) => (
              <li className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3" key={m.id}>
                <span className="flex-1 text-sm font-bold text-slate-950">
                  {m.product.name}
                  {m.product.kind === ProductKind.INGREDIENT ? (
                    <Badge tone="neutral"> insumo</Badge>
                  ) : null}
                </span>
                <span className="text-sm text-slate-600">
                  {formatQuantity(m.quantity)} {unitShort(m.product.unit)}
                </span>
                <span className="text-sm font-semibold text-destructive">
                  {m.product.cost ? formatMoney(Math.round((m.product.cost * m.quantity) / 1000)) : "—"}
                </span>
                <span className="w-full text-xs italic text-slate-500 sm:w-auto">{m.reason}</span>
                <span className="text-xs text-slate-400">{fecha.format(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </AppShell>
  );
}
