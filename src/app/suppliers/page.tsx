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
  StatTiles,
  TableWrap,
  type Tone,
} from "@/components/manager-ui";
import { MoneyInput } from "@/components/money-input";
import { AppModule, PurchaseStatus, Unit } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-labels";
import { unitShort } from "@/lib/quantity";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import {
  findPurchasableProducts,
  getPurchases,
  getSuppliersWithDebt,
  isDueSoon,
  isOverdue,
} from "@/modules/suppliers/supplier.use-cases";

import {
  cancelPurchaseAction,
  createPurchaseAction,
  createSupplierAction,
  deletePurchaseAction,
  deleteSupplierAction,
  payPurchaseAction,
} from "./actions";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "2-digit" });

// Cuántos renglones en blanco ofrece el formulario de carga de factura.
const ITEM_ROWS = 4;

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  [PurchaseStatus.PENDING]: "Pendiente",
  [PurchaseStatus.PARTIAL]: "Pago parcial",
  [PurchaseStatus.PAID]: "Pagada",
  [PurchaseStatus.CANCELLED]: "Anulada",
};

type SuppliersPageProps = {
  searchParams: Promise<{ status?: string | string[]; message?: string | string[] }>;
};

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const { business } = await requireModule(AppModule.SUPPLIERS);
  await searchParams;

  const [suppliers, { purchases, summary }, branches, products] = await Promise.all([
    getSuppliersWithDebt(business.id),
    getPurchases(business.id),
    getBranchesForManagement(business.id),
    findPurchasableProducts(business.id),
  ]);

  const now = new Date();
  const activeSuppliers = suppliers.filter((supplier) => supplier.active);
  const today = toISODate(now);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Proveedores"
        description="A quién le comprás, cuánto le debés y qué se vence."
      />

      <StatTiles
        tiles={[
          { label: "Deuda total", value: formatMoney(summary.pending), tone: summary.pending > 0 ? "info" : "neutral" },
          {
            label: "Vencido",
            value: formatMoney(summary.overdue),
            hint: `${summary.overdueCount} factura(s)`,
            tone: summary.overdue > 0 ? "danger" : "neutral",
          },
          {
            label: "Vence esta semana",
            value: formatMoney(summary.dueSoon),
            hint: `${summary.dueSoonCount} factura(s)`,
            tone: summary.dueSoon > 0 ? "warning" : "neutral",
          },
          { label: "Proveedores", value: String(activeSuppliers.length) },
        ]}
      />

      <SectionCard title="Cuentas a pagar" description="Ordenadas por vencimiento: lo más urgente primero.">
        {purchases.length === 0 ? (
          <EmptyState title="No hay facturas de compra cargadas." hint="Cargá una abajo para empezar a controlar la deuda." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-wider text-slate-400">
                  <th className="pb-2 font-bold">Proveedor</th>
                  <th className="pb-2 font-bold">Comprobante</th>
                  <th className="pb-2 font-bold">Vence</th>
                  <th className="pb-2 font-bold">Total</th>
                  <th className="pb-2 font-bold">Falta</th>
                  <th className="pb-2 font-bold">Estado</th>
                  <th className="pb-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const payable = {
                    id: purchase.id,
                    total: purchase.total,
                    paid: purchase.paid,
                    status: purchase.status,
                    dueAt: purchase.dueAt,
                  };
                  const overdue = isOverdue(payable, now);
                  const soon = isDueSoon(payable, now);

                  const tone: Tone =
                    purchase.status === PurchaseStatus.PAID
                      ? "positive"
                      : purchase.status === PurchaseStatus.CANCELLED
                        ? "neutral"
                        : overdue
                          ? "danger"
                          : soon
                            ? "warning"
                            : "info";

                  return (
                    <tr className="border-t border-slate-100 align-top" key={purchase.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-bold text-slate-950">{purchase.supplier.name}</p>
                        <p className="text-xs text-slate-400">
                          {purchase.branch?.name ?? "Sin sucursal"} · {purchase.items.length} ítem(s)
                        </p>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">{purchase.number ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {purchase.dueAt ? dateFormatter.format(purchase.dueAt) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">{formatMoney(purchase.total)}</td>
                      <td className="py-2.5 pr-3 font-bold text-slate-950">{formatMoney(purchase.pending)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={tone}>{overdue ? "Vencida" : STATUS_LABELS[purchase.status]}</Badge>
                      </td>
                      <td className="py-2.5">
                        {purchase.pending > 0 && purchase.status !== PurchaseStatus.CANCELLED ? (
                          <form action={payPurchaseAction} className="flex flex-wrap items-center gap-1.5">
                            <input name="purchaseId" type="hidden" value={purchase.id} />
                            <MoneyInput
                              aria-label="Importe a pagar"
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                              defaultValue={purchase.pending}
                              name="amount"
                            />
                            <select
                              aria-label="Cuenta"
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold"
                              name="method"
                            >
                              {PAYMENT_METHOD_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <GhostButton>Pagar</GhostButton>
                          </form>
                        ) : null}
                        <div className="mt-1.5 flex gap-1.5">
                          {purchase.status !== PurchaseStatus.CANCELLED && purchase.paid === 0 ? (
                            <form action={cancelPurchaseAction}>
                              <input name="purchaseId" type="hidden" value={purchase.id} />
                              <GhostButton>Anular</GhostButton>
                            </form>
                          ) : null}
                          <form action={deletePurchaseAction}>
                            <input name="purchaseId" type="hidden" value={purchase.id} />
                            <DangerButton>Borrar</DangerButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </SectionCard>

      {activeSuppliers.length > 0 ? (
        <SectionCard
          title="Cargar factura de compra"
          description="Registra la deuda y, si elegís sucursal, mete la mercadería en el stock."
        >
          <form action={createPurchaseAction} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Proveedor">
                <select className={selectClass} name="supplierId" required>
                  {activeSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nº de comprobante">
                <input className={inputClass} name="number" placeholder="0001-00012345" />
              </Field>
              <Field label="Fecha">
                <input className={inputClass} defaultValue={today} name="issuedAt" type="date" />
              </Field>
              <Field label="Vence">
                <input className={inputClass} name="dueAt" type="date" />
              </Field>
              <Field label="Entra en" hint="Requerido si hay productos con stock" className="sm:col-span-2">
                <select className={selectClass} name="branchId">
                  <option value="">Sin impacto en stock</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notas" className="sm:col-span-2">
                <input className={inputClass} name="notes" placeholder="Remito 123" />
              </Field>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Ítems</p>
              <div className="space-y-2">
                {Array.from({ length: ITEM_ROWS }).map((_, index) => (
                  <div className="grid gap-2 sm:grid-cols-12" key={index}>
                    <select className={`${selectClass} sm:col-span-4`} name="itemProductId">
                      <option value="">— Ítem sin producto —</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({unitShort(product.unit)})
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Descripción"
                      className={`${inputClass} sm:col-span-3`}
                      name="itemDescription"
                      placeholder="Descripción"
                    />
                    <input
                      aria-label="Cantidad"
                      className={`${inputClass} sm:col-span-2`}
                      inputMode="decimal"
                      name="itemQuantity"
                      placeholder="Cant."
                    />
                    <select aria-label="Unidad" className={`${selectClass} sm:col-span-1`} name="itemUnit">
                      {Object.values(Unit).map((value) => (
                        <option key={value} value={value}>
                          {unitShort(value)}
                        </option>
                      ))}
                    </select>
                    <MoneyInput
                      aria-label="Costo unitario"
                      className={`${inputClass} sm:col-span-2`}
                      name="itemUnitCost"
                      placeholder="Costo $"
                    />
                  </div>
                ))}
              </div>
            </div>

            <PrimaryButton className="justify-self-start">Cargar factura</PrimaryButton>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Proveedores" description="Con lo que le debés a cada uno.">
        {suppliers.length === 0 ? (
          <EmptyState title="Todavía no cargaste proveedores." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-wider text-slate-400">
                  <th className="pb-2 font-bold">Proveedor</th>
                  <th className="pb-2 font-bold">Compras</th>
                  <th className="pb-2 font-bold">Le debés</th>
                  <th className="pb-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr className="border-t border-slate-100" key={supplier.id}>
                    <td className="py-2.5 pr-3">
                      <p className="font-bold text-slate-950">{supplier.name}</p>
                      <p className="text-xs text-slate-400">
                        {supplier.phone ?? supplier.taxId ?? "Sin datos"}
                        {supplier.active ? "" : " · inactivo"}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{supplier.purchaseCount}</td>
                    <td className="py-2.5 pr-3">
                      {supplier.debt > 0 ? (
                        <Badge tone="warning">{formatMoney(supplier.debt)}</Badge>
                      ) : (
                        <Badge tone="positive">Al día</Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <form action={deleteSupplierAction}>
                        <input name="supplierId" type="hidden" value={supplier.id} />
                        <DangerButton>Eliminar</DangerButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </SectionCard>

      <SectionCard title="Nuevo proveedor">
        <form action={createSupplierAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2">
            <input className={inputClass} name="name" placeholder="Distribuidora del Centro" required />
          </Field>
          <Field label="CUIT">
            <input className={inputClass} name="taxId" placeholder="30123456789" />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} name="phone" placeholder="11 5555-5555" />
          </Field>
          <Field label="Email">
            <input className={inputClass} name="email" placeholder="ventas@proveedor.com" type="email" />
          </Field>
          <Field label="Dirección">
            <input className={inputClass} name="address" />
          </Field>
          <PrimaryButton className="sm:col-span-2">Crear proveedor</PrimaryButton>
        </form>
      </SectionCard>
    </AppShell>
  );
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
