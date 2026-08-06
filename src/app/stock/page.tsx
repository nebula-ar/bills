import Link from "next/link";
import { AppShell, PageHeader } from "@/components/app-shell";
import {
  Badge,
  EmptyState,
  Field,
  formatMoney,
  GhostButton,
  inputClass,
  PrimaryButton,
  SectionCard,
  selectClass,
  StatTiles,
} from "@/components/manager-ui";
import { RefreshActionForm } from "@/components/refresh-action-form";
import { StockEmpty, StockManager } from "@/components/stock-manager";
import { AppModule, ProductKind } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { formatQuantity, unitShort } from "@/lib/quantity";
import { STOCK_MOVEMENT_LABELS } from "@/lib/stock-error-messages";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { getBranchStockOverview, getStockMovements } from "@/modules/stock/stock.use-cases";

import { transferStockAction } from "./actions";

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

  const alerts = rows.filter((row) => row.status !== "ok");
  const products = rows.map((row) => ({ id: row.productId, name: row.name, unit: row.unit }));

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Stock"
        description={`El depósito de ${branch.name}: qué falta, qué se movió y traspasos entre sucursales.`}
      />

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
        <form className="flex flex-wrap items-end gap-3" action="/stock">
          <Field label="Sucursal" className="min-w-[12rem] flex-1">
            <select className={selectClass} defaultValue={branch.id} name="branchId">
              {activeBranches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <GhostButton className="mb-0.5">Ver</GhostButton>
        </form>
      ) : null}

      <StatTiles
        tiles={[
          { label: "Productos", value: String(totals.products) },
          { label: "Valorizado", value: formatMoney(totals.value), hint: "A precio de costo", tone: "info" },
          {
            label: "Por reponer",
            value: String(totals.low),
            hint: "Bajo el mínimo",
            tone: totals.low > 0 ? "warning" : "neutral",
          },
          { label: "Sin stock", value: String(totals.out), tone: totals.out > 0 ? "danger" : "neutral" },
        ]}
      />

      {alerts.length > 0 ? (
        <SectionCard title="Hay que reponer" description="Productos en cero o por debajo del mínimo que configuraste.">
          <ul className="flex flex-wrap gap-2">
            {alerts.map((row) => (
              <li
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                key={row.productId}
              >
                <span className="text-sm font-bold text-slate-800">{row.name}</span>
                <Badge tone={row.status === "out" ? "danger" : "warning"}>
                  {row.status === "out" ? "Sin stock" : `Quedan ${formatQuantity(row.quantity, row.unit)}`}
                </Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

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
            productName: movement.product.name,
            unit: movement.product.unit,
            quantity: movement.quantity,
            typeLabel: STOCK_MOVEMENT_LABELS[movement.type],
            reason: movement.reason,
            when: dateFormatter.format(movement.occurredAt),
          }))}
          rows={rows.map((row) => ({
            productId: row.productId,
            name: row.name,
            sku: row.sku,
            unit: row.unit,
            esInsumo: row.kind === ProductKind.INGREDIENT,
            categoryName: row.categoryName,
            quantity: row.quantity,
            minStock: row.minStock,
            cost: row.cost,
            stockValue: row.stockValue,
            status: row.status,
          }))}
        />
      )}

      <div className="grid gap-4">
        {activeBranches.length > 1 ? (
          <SectionCard title="Traspaso entre sucursales" description="Sale de una y entra en la otra, en un solo acto.">
            <RefreshActionForm action={transferStockAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <input name="branchId" type="hidden" value={branch.id} />
              <Field label="Producto" className="sm:col-span-2">
                <select className={selectClass} name="productId" required>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({unitShort(product.unit)})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hacia">
                <select className={selectClass} name="toBranchId" required>
                  {activeBranches
                    .filter((item) => item.id !== branch.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Cantidad">
                <input className={inputClass} inputMode="decimal" name="quantity" placeholder="0" required />
              </Field>
              <PrimaryButton className="sm:col-span-2">Traspasar</PrimaryButton>
            </RefreshActionForm>
          </SectionCard>
        ) : null}
      </div>

    </AppShell>
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}
