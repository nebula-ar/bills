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
  TableWrap,
} from "@/components/manager-ui";
import { MoneyInput } from "@/components/money-input";
import { RefreshActionForm } from "@/components/refresh-action-form";
import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { formatQuantity, unitShort } from "@/lib/quantity";
import { STOCK_MOVEMENT_LABELS } from "@/lib/stock-error-messages";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { getBranchStockOverview, getStockMovements } from "@/modules/stock/stock.use-cases";

import { adjustStockAction, receiveStockAction, registerLossAction, transferStockAction } from "./actions";

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
      <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
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

      <SectionCard title="Existencias" description={`${rows.length} productos con control de stock.`}>
        {rows.length === 0 ? (
          <EmptyState
            title="Ningún producto lleva control de stock todavía."
            hint="Activá «Controla stock» en el catálogo para empezar a contarlo."
          />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-wider text-slate-400">
                  <th className="pb-2 font-bold">Producto</th>
                  <th className="pb-2 font-bold">Existencia</th>
                  <th className="pb-2 font-bold">Mínimo</th>
                  <th className="pb-2 font-bold">Costo</th>
                  <th className="pb-2 font-bold">Valorizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-t border-slate-100" key={row.productId}>
                    <td className="py-2.5 pr-3">
                      <p className="font-bold text-slate-950">{row.name}</p>
                      <p className="text-xs text-slate-400">
                        {row.categoryName ?? "Sin categoría"}
                        {row.sku ? ` · ${row.sku}` : ""}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={row.status === "out" ? "danger" : row.status === "low" ? "warning" : "positive"}>
                        {formatQuantity(row.quantity, row.unit)}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">
                      {row.minStock !== null ? formatQuantity(row.minStock, row.unit) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{row.cost ? formatMoney(row.cost) : "—"}</td>
                    <td className="py-2.5 font-bold text-slate-800">{formatMoney(row.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Ajustar por conteo"
          description="Contá lo que hay de verdad y el sistema asienta la diferencia."
        >
          <RefreshActionForm action={adjustStockAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
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
            <Field label="Contado" hint="Podés usar decimales: 1,250">
              <input className={inputClass} inputMode="decimal" name="counted" placeholder="0" required />
            </Field>
            <Field label="Motivo">
              <input className={inputClass} name="reason" placeholder="Conteo de fin de mes" />
            </Field>
            <PrimaryButton className="sm:col-span-2">Guardar ajuste</PrimaryButton>
          </RefreshActionForm>
        </SectionCard>

        <SectionCard title="Ingreso de mercadería" description="Lo que llega sin factura cargada todavía.">
          <RefreshActionForm action={receiveStockAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
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
            <Field label="Cantidad">
              <input className={inputClass} inputMode="decimal" name="quantity" placeholder="0" required />
            </Field>
            <Field label="Costo unitario" hint="Opcional: actualiza el costo">
              <MoneyInput className={inputClass} name="unitCost" placeholder="$" />
            </Field>
            <PrimaryButton className="sm:col-span-2">Ingresar</PrimaryButton>
          </RefreshActionForm>
        </SectionCard>

        <SectionCard title="Registrar merma" description="Rotura, vencimiento o faltante. Sale del stock con su motivo.">
          <RefreshActionForm action={registerLossAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
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
            <Field label="Cantidad">
              <input className={inputClass} inputMode="decimal" name="quantity" placeholder="0" required />
            </Field>
            <Field label="Motivo">
              <input className={inputClass} name="reason" placeholder="Se pasó de fecha" />
            </Field>
            <PrimaryButton className="sm:col-span-2">Registrar merma</PrimaryButton>
          </RefreshActionForm>
        </SectionCard>

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

      <SectionCard title="Últimos movimientos" description="Cada unidad que entró o salió, y por qué.">
        {movements.length === 0 ? (
          <EmptyState title="Todavía no hay movimientos en esta sucursal." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {movements.map((movement) => (
              <li className="flex items-center justify-between gap-3 py-2.5" key={movement.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{movement.product.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {STOCK_MOVEMENT_LABELS[movement.type]}
                    {movement.reason ? ` · ${movement.reason}` : ""} · {dateFormatter.format(movement.occurredAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-black ${movement.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {movement.quantity >= 0 ? "+" : "−"}
                  {formatQuantity(Math.abs(movement.quantity), movement.product.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </AppShell>
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}
