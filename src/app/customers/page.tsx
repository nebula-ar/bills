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
  StatTiles,
  TableWrap,
} from "@/components/manager-ui";
import { MoneyInput } from "@/components/money-input";
import { AppModule, TaxCondition } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-labels";
import { getBranchesForManagement } from "@/modules/branches/get-branches-for-management.use-case";
import { getCustomerDetail, getCustomersForManagement } from "@/modules/customers/customer.use-cases";
import { getCustomerPoints } from "@/modules/marketing/marketing.use-cases";
import { loyaltyEnabled } from "@/modules/marketing/loyalty.logic";
import { LoyaltyRedeem } from "@/components/loyalty-redeem";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { debtReminderMessage } from "@/modules/messaging/whatsapp.logic";
import { WhatsappButton } from "@/components/whatsapp-button";
import Link from "next/link";

import { createCustomerAction, deleteCustomerAction, registerPaymentAction, updateCustomerAction } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "2-digit" });

const TAX_CONDITION_LABELS: Record<TaxCondition, string> = {
  [TaxCondition.CONSUMIDOR_FINAL]: "Consumidor final",
  [TaxCondition.RESPONSABLE_INSCRIPTO]: "Responsable inscripto",
  [TaxCondition.MONOTRIBUTO]: "Monotributo",
  [TaxCondition.EXENTO]: "Exento",
  [TaxCondition.NO_RESPONSABLE]: "No responsable",
};

type CustomersPageProps = {
  searchParams: Promise<{ customerId?: string | string[]; status?: string | string[]; message?: string | string[] }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { business } = await requireModule(AppModule.CUSTOMERS);

  const params = await searchParams;
  const selectedId = single(params.customerId);

  const [customers, branches] = await Promise.all([
    getCustomersForManagement(business.id),
    getBranchesForManagement(business.id),
  ]);

  const detail = selectedId ? await getCustomerDetail(selectedId, business.id).catch(() => null) : null;

  // Los puntos del cliente abierto, si el negocio usa el programa.
  const points =
    detail && business.has(AppModule.MARKETING) ? await getCustomerPoints(detail.customer.id, business.id) : null;

  const totalDebt = customers.reduce((sum, customer) => sum + Math.max(customer.balance, 0), 0);
  const debtors = customers.filter((customer) => customer.balance > 0);
  const overLimit = customers.filter((customer) => customer.overLimit);

  return (
    <AppShell maxWidth="lg">
      <PageHeader
        eyebrow="Bills"
        title="Clientes"
        description="Ficha, historial de compras y cuenta corriente (lo que te deben)."
      />

      <StatTiles
        tiles={[
          { label: "Clientes", value: String(customers.length) },
          { label: "Te deben", value: formatMoney(totalDebt), tone: totalDebt > 0 ? "warning" : "neutral" },
          { label: "Con deuda", value: String(debtors.length) },
          {
            label: "Pasados de límite",
            value: String(overLimit.length),
            tone: overLimit.length > 0 ? "danger" : "neutral",
          },
        ]}
      />

      {detail ? (
        <SectionCard
          title={detail.customer.name}
          description={
            detail.balance > 0
              ? `Debe ${formatMoney(detail.balance)}${detail.customer.creditLimit ? ` de un límite de ${formatMoney(detail.customer.creditLimit)}` : ""}.`
              : "Está al día."
          }
          actions={
            <Link className="text-xs font-bold text-blue-600 hover:underline" href="/customers">
              Cerrar ficha
            </Link>
          }
        >
          {/* Puntos: solo si el negocio tiene el programa configurado. */}
          {points && loyaltyEnabled(points.rules) ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 p-4 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/50">Puntos</p>
                <p className="text-2xl font-black tracking-tight">
                  {points.balance}
                  <span className="ml-2 text-sm font-bold text-white/60">= {formatMoney(points.value)}</span>
                </p>
              </div>
              {points.balance > 0 ? (
                <LoyaltyRedeem
                  balance={points.balance}
                  branchId={branches[0]?.id ?? ""}
                  customerId={detail.customer.id}
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cuenta corriente</h3>
                {/* El recordatorio de fiado se manda por WhatsApp porque es
                    donde ya está la conversación con el cliente. */}
                {detail.balance > 0 ? (
                  <WhatsappButton
                    label="Recordar deuda"
                    message={debtReminderMessage({
                      businessName: business.name,
                      customerName: detail.customer.name,
                      balance: detail.balance,
                    })}
                    phone={detail.customer.phone}
                  />
                ) : null}
              </div>
              {detail.balance > 0 ? (
                <form action={registerPaymentAction} className="mt-2 grid gap-3 sm:grid-cols-2">
                  <input name="customerId" type="hidden" value={detail.customer.id} />
                  <Field label="Importe">
                    <MoneyInput className={inputClass} name="amount" placeholder="$" required />
                  </Field>
                  <Field label="Cobrado en">
                    <select className={selectClass} name="method">
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {branches.length > 1 ? (
                    <Field label="Sucursal" className="sm:col-span-2">
                      <select className={selectClass} name="branchId">
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <input name="branchId" type="hidden" value={branches[0]?.id ?? ""} />
                  )}
                  <PrimaryButton className="sm:col-span-2">Registrar pago</PrimaryButton>
                </form>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No tiene deuda pendiente.</p>
              )}

              <ul className="mt-4 divide-y divide-slate-100">
                {detail.entries.map((entry) => (
                  <li className="flex items-center justify-between gap-3 py-2" key={entry.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {entry.type === "CHARGE" ? "Venta a cuenta" : entry.type === "PAYMENT" ? "Pago" : "Ajuste"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {dateFormatter.format(entry.occurredAt)}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-black ${entry.amount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {entry.amount > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(entry.amount))}
                    </span>
                  </li>
                ))}
                {detail.entries.length === 0 ? (
                  <li className="py-2 text-sm text-slate-400">Sin movimientos de cuenta.</li>
                ) : null}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Datos</h3>
              <form action={updateCustomerAction} className="mt-2 grid gap-3 sm:grid-cols-2">
                <input name="customerId" type="hidden" value={detail.customer.id} />
                <Field label="Nombre" className="sm:col-span-2">
                  <input className={inputClass} defaultValue={detail.customer.name} name="name" required />
                </Field>
                <Field label="Teléfono">
                  <input className={inputClass} defaultValue={detail.customer.phone ?? ""} name="phone" />
                </Field>
                <Field label="Cumpleaños" hint="Para saludarlo desde Marketing">
                  <input
                    className={inputClass}
                    defaultValue={detail.customer.birthday ? toISODate(detail.customer.birthday) : ""}
                    name="birthday"
                    type="date"
                  />
                </Field>
                <Field label="CUIT / DNI">
                  <input className={inputClass} defaultValue={detail.customer.taxId ?? ""} name="taxId" />
                </Field>
                <Field label="Condición IVA">
                  <select className={selectClass} defaultValue={detail.customer.taxCondition ?? ""} name="taxCondition">
                    <option value="">Sin especificar</option>
                    {Object.entries(TAX_CONDITION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Límite de crédito" hint="Vacío = sin tope">
                  <MoneyInput
                    className={inputClass}
                    defaultValue={detail.customer.creditLimit ?? ""}
                    name="creditLimit"
                  />
                </Field>
                <Field label="Notas" className="sm:col-span-2">
                  <input className={inputClass} defaultValue={detail.customer.notes ?? ""} name="notes" />
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                  <input defaultChecked={detail.customer.active} name="active" type="checkbox" />
                  Activo (puede comprar y fiar)
                </label>
                <PrimaryButton className="sm:col-span-2">Guardar cambios</PrimaryButton>
              </form>

              <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Últimas compras</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {detail.sales.map((sale) => (
                  <li className="flex items-center justify-between gap-3 py-2" key={sale.id}>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-500">
                        {dateFormatter.format(sale.soldAt)} · {sale.branch.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {sale.items.map((item) => item.description).join(", ")}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-slate-800">{formatMoney(sale.total)}</span>
                  </li>
                ))}
                {detail.sales.length === 0 ? <li className="py-2 text-sm text-slate-400">Sin compras.</li> : null}
              </ul>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Todos los clientes" description="Tocá un cliente para ver su cuenta y su historial.">
        {customers.length === 0 ? (
          <EmptyState title="Todavía no cargaste clientes." hint="Sirven para fiar, hacer seguimiento y facturar." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[0.68rem] uppercase tracking-wider text-slate-400">
                  <th className="pb-2 font-bold">Cliente</th>
                  <th className="pb-2 font-bold">Compras</th>
                  <th className="pb-2 font-bold">Saldo</th>
                  <th className="pb-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr className="border-t border-slate-100" key={customer.id}>
                    <td className="py-2.5 pr-3">
                      <Link className="font-bold text-slate-950 hover:text-blue-600" href={`/customers?customerId=${customer.id}`}>
                        {customer.name}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {customer.phone ?? customer.taxId ?? "Sin datos de contacto"}
                        {customer.active ? "" : " · inactivo"}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{customer.salesCount}</td>
                    <td className="py-2.5 pr-3">
                      {customer.balance > 0 ? (
                        <Badge tone={customer.overLimit ? "danger" : "warning"}>
                          Debe {formatMoney(customer.balance)}
                        </Badge>
                      ) : (
                        <Badge tone="positive">Al día</Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {/* Dos toques: borrar un cliente se lleva su historial
                          y no hay forma de traerlo de vuelta. */}
                      <form action={deleteCustomerAction}>
                        <input name="customerId" type="hidden" value={customer.id} />
                        <ConfirmSubmit>Eliminar</ConfirmSubmit>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </SectionCard>

      <SectionCard title="Nuevo cliente" description="Con el límite de crédito controlás hasta cuánto le podés fiar.">
        <form action={createCustomerAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2">
            <input className={inputClass} name="name" placeholder="Juan Pérez" required />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} name="phone" placeholder="11 5555-5555" />
          </Field>
          <Field label="CUIT / DNI">
            <input className={inputClass} name="taxId" placeholder="20123456789" />
          </Field>
          <Field label="Límite de crédito" hint="Vacío = sin tope">
            <MoneyInput className={inputClass} name="creditLimit" placeholder="$" />
          </Field>
          <Field label="Notas">
            <input className={inputClass} name="notes" placeholder="Pasa los martes" />
          </Field>
          <input defaultChecked name="active" type="hidden" value="on" />
          <PrimaryButton className="sm:col-span-2">Crear cliente</PrimaryButton>
        </form>
      </SectionCard>
    </AppShell>
  );
}

function single(value: string | string[] | undefined) {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}

function toISODate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
