import Link from "next/link";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PeriodFade } from "@/components/period-fade";
import { Reveal } from "@/components/reveal";
import { StatTiles } from "@/components/stat-tiles";
import {
  EmptyState,
  Field,
  formatMoney,
  inputClass,
  PrimaryButton,
  SectionCard,
} from "@/components/manager-ui";
import { RefreshActionForm } from "@/components/refresh-action-form";
import { StockEmpty, StockManager } from "@/components/stock-manager";
import { BranchPicker } from "@/components/branch-picker";
import { SyncfusionGestionProvider } from "@/components/syncfusion-gestion-provider";
import { AppModule, ProductKind } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { unitShort } from "@/lib/quantity";
import { STOCK_MOVEMENT_LABELS } from "@/lib/stock-error-messages";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { getBranchStockOverview, getStockMovements } from "@/modules/stock/stock.use-cases";

import { transferStockAction } from "./actions";
import { SelectField } from "@/components/ui/select-field";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

type StockPageProps = {
  searchParams: Promise<{ branchId?: string | string[]; status?: string | string[]; message?: string | string[] }>;
};

export default async function StockPage({ searchParams }: StockPageProps) {
  const { business } = await requireModule(AppModule.STOCK);

  const params = await searchParams;
  const requestedBranchId = single(params.branchId);

  const branches = await getBranchesForManagement(business.id);
  const activeBranches = branches.filter((branch) => branch.active);
  const branch = activeBranches.find((item) => item.id === requestedBranchId) ?? activeBranches[0];

  if (!branch) {
    return (
      <AppShell maxWidth="lg">
        <PageHeader eyebrow="Bills" title="Stock" description="Existencias por sucursal." />
        <EmptyState title="Cargá una sucursal para llevar el stock." hint="Sucursales → Nueva sucursal" />
      </AppShell>
    );
  }

  const [{ rows, totals }, movements] = await Promise.all([
    getBranchStockOverview(business.id, branch.id),
    getStockMovements(branch.id, 30),
  ]);

  const products = rows.map((row) => ({ id: row.productId, name: row.name, unit: row.unit }));

  return (
    <SyncfusionGestionProvider>
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Stock"
        description={`El depósito de ${branch.name}: qué falta, qué se movió y traspasos entre sucursales.`}
      />

      <Reveal>
      {/* Lo de un producto puntual se resuelve en su propia ficha: ir y venir
          entre dos pantallas para una cosa que es una sola era el problema. */}
      <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
        Para cargar, contar o descontar UN producto, tocalo en{" "}
        <Link className="font-black underline" href="/catalog">
          {business.labels.catalogPlural}
        </Link>{" "}
        y hacelo desde su ficha, sin buscarlo de nuevo.
      </p>

      {activeBranches.length > 1 ? (
        <Field label="Sucursal" className="min-w-[12rem] flex-1">
          <BranchPicker branches={activeBranches} current={branch.id} />
        </Field>
      ) : null}

      <StatTiles
        tiles={[
          { label: "Productos", value: String(totals.products), amount: totals.products, kind: "int" },
          {
            label: "Sin stock",
            value: String(totals.out),
            amount: totals.out,
            kind: "int",
            tone: totals.out > 0 ? "danger" : "neutral",
          },
          {
            label: "Por reponer",
            value: String(totals.low),
            amount: totals.low,
            kind: "int",
            hint: "Bajo el mínimo",
            tone: totals.low > 0 ? "warning" : "neutral",
          },
          {
            label: "Valorizado",
            value: formatMoney(totals.value),
            amount: totals.value,
            kind: "money",
            hint: "A precio de costo",
            tone: "info",
          },
        ]}
      />

      <PeriodFade period={`stock-${branch.id}`}>
      {/* La lista, sus pestañas y el modal de carga viven en el cliente: son
          estado de pantalla (qué pestaña, qué producto se está moviendo) y no
          justifican un viaje al servidor por cada toque. */}
      {rows.length === 0 ? (
        <StockEmpty />
      ) : (
        <StockManager
          branchId={branch.id}
          branchName={branch.name}
          catalogPlural={business.labels.catalogPlural}
          movements={movements.map((movement) => ({
            id: movement.id,
            productId: movement.product.id,
            productName: movement.product.name,
            unit: movement.product.unit,
            quantity: movement.quantity,
            typeLabel: STOCK_MOVEMENT_LABELS[movement.type],
            reason: movement.reason,
            when: dateFormatter.format(movement.occurredAt),
            whenTs: movement.occurredAt.getTime(),
          }))}
          rows={rows.map((row) => ({
            productId: row.productId,
            name: row.name,
            sku: row.sku,
            unit: row.unit,
            esInsumo: row.kind === ProductKind.INGREDIENT,
            categoryName: row.categoryName,
            imageVersion: row.imageVersion,
            catalogSlug: row.catalogSlug,
            quantity: row.quantity,
            minStock: row.minStock,
            cost: row.cost,
            stockValue: row.stockValue,
            status: row.status,
          }))}
        />
      )}
      </PeriodFade>

      <div className="grid gap-4">
        {activeBranches.length > 1 ? (
          <SectionCard title="Traspaso entre sucursales" description="Sale de una y entra en la otra, en un solo acto.">
            <RefreshActionForm action={transferStockAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <input name="branchId" type="hidden" value={branch.id} />
              <Field label="Producto" className="sm:col-span-2">
                <SelectField
                  ariaLabel="Producto"
                  name="productId"
                  options={products.map((product) => ({
                    value: product.id,
                    label: `${product.name} (${unitShort(product.unit)})`,
                  }))}
                />
              </Field>
              <Field label="Hacia">
                <SelectField
                  ariaLabel="Sucursal destino"
                  name="toBranchId"
                  options={activeBranches
                    .filter((item) => item.id !== branch.id)
                    .map((item) => ({ value: item.id, label: item.name }))}
                />
              </Field>
              <Field label="Cantidad">
                <input className={inputClass} inputMode="decimal" name="quantity" placeholder="0" required />
              </Field>
              <PrimaryButton className="sm:col-span-2">Traspasar</PrimaryButton>
            </RefreshActionForm>
          </SectionCard>
        ) : null}
      </div>
      </Reveal>
    </AppShell>
    </SyncfusionGestionProvider>
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}
