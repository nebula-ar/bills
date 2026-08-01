"use client";

import {
  cancelPurchaseAction,
  createExpenseAction,
  createPurchaseAction,
  createSupplierAction,
  creditPurchaseAction,
  deleteExpenseAction,
  deletePurchaseAction,
  deleteSupplierAction,
  payPurchaseAction,
  paySupplierAction,
  updateExpenseAction,
  type ActionResult,
} from "@/app/expenses/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  X,
} from "@/components/icons";
import { MoneyInput } from "@/components/money-input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

// Un renglón de lo que salió este mes. Puede ser un gasto suelto (ya pago) o el
// pago de una factura de proveedor: en la lista se ven igual porque para el
// dueño son lo mismo —plata que se fue— y solo cambia adónde lleva el toque.
export type OutflowRow = {
  kind: "EXPENSE" | "PAYMENT";
  id: string;
  occurredAt: Date;
  amount: number;
  amountLabel: string;
  dateLabel: string;
  title: string;
  accountLabel: string;
  detail: string;
  // Solo en los gastos: lo que necesita el formulario de edición.
  expense?: {
    category: string;
    paymentMethod: string;
    branchId: string | null;
    supplierId: string | null;
    note: string | null;
    spentAtValue: string;
  };
  // Solo en los pagos: la factura que se abre al tocarlo.
  purchaseId?: string;
};

export type PayableRow = {
  id: string;
  supplierName: string;
  number: string | null;
  branchLabel: string | null;
  total: number;
  totalLabel: string;
  paidLabel: string;
  pending: number;
  pendingLabel: string;
  dueLabel: string | null;
  overdue: boolean;
  dueSoon: boolean;
  canCancel: boolean;
  // Notas de crédito ya aplicadas: bajan la deuda sin haber movido plata.
  creditedLabel: string | null;
  // null = mercadería. Si tiene categoría es un gasto operativo (un service, un
  // flete) y no entró al stock.
  categoryLabel: string | null;
  items: { id: string; label: string; quantityLabel: string; totalLabel: string }[];
  payments: { id: string; amountLabel: string; accountLabel: string; dateLabel: string }[];
};

export type ExpensesData = {
  businessName: string;
  monthKey: string;
  monthLabel: string;
  prevMonthKey: string;
  nextMonthKey: string;
  totalLabel: string;
  count: number;
  showsSuppliers: boolean;
  debtLabel: string;
  hasDebt: boolean;
  overdueCount: number;
  branches: { id: string; name: string }[];
  purchaseBranches: { id: string; name: string }[];
  categories: { value: string; label: string }[];
  // Cuál de las categorías es "Mercadería", para avisar que no baja la ganancia.
  merchandiseCategory: string;
  // Solo un Responsable Inscripto recupera el IVA. Para un monotributista el
  // IVA es parte del costo y preguntárselo es ruido.
  showsVat: boolean;
  paymentMethods: { value: string; label: string }[];
  suppliers: {
    id: string;
    name: string;
    contact: string | null;
    active: boolean;
    purchaseCount: number;
    debt: number;
    debtLabel: string | null;
  }[];
  products: { id: string; label: string }[];
  units: { value: string; label: string }[];
  todayValue: string;
  outflows: OutflowRow[];
  payables: PayableRow[];
};

const sheetField =
  "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6">
      <h3 className="text-xl font-black tracking-tight text-slate-950">{title}</h3>
      <button
        aria-label="Cerrar"
        className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
        onClick={onClose}
        type="button"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

function SubmitBar({ label, pending }: { label: string; pending: boolean }) {
  return (
    <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
        disabled={pending}
        type="submit"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {label}
      </button>
    </div>
  );
}

function Chips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            className={`rounded-full px-3.5 py-2 text-sm font-bold transition active:scale-95 ${
              option.value === value ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-slate-100 text-slate-600"
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
      {label}
      <div className="relative">
        <select className={`w-full appearance-none pr-11 ${sheetField}`} defaultValue={defaultValue} name={name}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

// Los campos de un gasto. El proveedor es opcional y solo aparece si el negocio
// le compra a alguien: en una barbería sin proveedores sería una pregunta más
// que nadie sabe para qué está.
function ExpenseFields({
  data,
  row,
}: {
  data: ExpensesData;
  row?: OutflowRow["expense"];
}) {
  const [category, setCategory] = useState(row?.category ?? data.categories[2]?.value ?? data.categories[0]?.value ?? "");
  const [paymentMethod, setPaymentMethod] = useState(row?.paymentMethod ?? data.paymentMethods[0]?.value ?? "");

  return (
    <div className="space-y-4">
      <input name="category" type="hidden" value={category} />
      <input name="paymentMethod" type="hidden" value={paymentMethod} />

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Monto
        <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
          <span className="text-2xl font-black text-slate-400">$</span>
          <MoneyInput
            className="w-full bg-transparent px-2 py-3.5 text-2xl font-black text-slate-950 outline-none"
            name="amount"
            placeholder="0"
          />
        </div>
      </label>

      <Chips label="Categoría" onChange={setCategory} options={data.categories} value={category} />

      {/* Comprar mercadería no es un gasto: es cambiar plata por stock. Sale de
          la caja igual, pero la ganancia la descuenta la venta. Si no se dice
          acá, el dueño ve el gasto cargado y la ganancia sin moverse. */}
      {category === data.merchandiseCategory ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs normal-case tracking-normal text-slate-500">
          Sale de la caja, pero no baja la ganancia: la mercadería se descuenta cuando la vendés, no cuando la comprás.
          Mientras tanto cuenta como stock.
        </p>
      ) : null}

      <Chips label="¿De qué cuenta salió?" onChange={setPaymentMethod} options={data.paymentMethods} value={paymentMethod} />

      {data.showsSuppliers && data.suppliers.length > 0 ? (
        <SelectField defaultValue={row?.supplierId ?? ""} label="Proveedor (opcional)" name="supplierId">
          <option value="">Sin proveedor</option>
          {data.suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <SelectField defaultValue={row?.branchId ?? ""} label="Sucursal" name="branchId">
        <option value="">General (todo el negocio)</option>
        {data.branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </SelectField>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Fecha
        <input className={sheetField} defaultValue={row?.spentAtValue ?? data.todayValue} name="spentAt" type="date" />
      </label>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Nota (opcional)
        <input
          className={sheetField}
          defaultValue={row?.note ?? ""}
          name="note"
          placeholder="Ej: shampoo y toallas"
          type="text"
        />
      </label>
    </div>
  );
}

// Renglones de una factura. Arranca con tres y se agregan de a uno: cuatro
// filas fijas en el celular era scrollear vacío, y cinco ítems no entraban.
const INITIAL_ITEM_ROWS = 3;

function PurchaseFields({ data }: { data: ExpensesData }) {
  const [rows, setRows] = useState(INITIAL_ITEM_ROWS);
  // Vacío = mercadería, que es el caso de siempre. Con categoría es un gasto
  // operativo: el service del freezer, un flete, el contador.
  const [category, setCategory] = useState("");
  const isMerchandise = category === "";

  return (
    <div className="space-y-4">
      <input name="expenseCategory" type="hidden" value={category} />

      <SelectField label="Proveedor" name="supplierId">
        {data.suppliers
          .filter((supplier) => supplier.active)
          .map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
      </SelectField>

      {/* Qué se compró decide todo lo demás: la mercadería entra al stock y se
          vuelve costo al venderse; un servicio es gasto del mes y no entra a
          ningún lado. */}
      <Chips
        label="¿Qué te facturó?"
        onChange={setCategory}
        options={[{ value: "", label: "Mercadería" }, ...data.categories.filter((option) => option.value !== data.merchandiseCategory)]}
        value={category}
      />
      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        {isMerchandise
          ? "Entra al stock y se descuenta de la ganancia recién cuando la vendas."
          : "Es un gasto del mes: baja la ganancia con la fecha de la factura y no toca el stock."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          Nº de comprobante
          <input className={sheetField} name="number" placeholder="0001-00012345" />
        </label>
        <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          Fecha
          <input className={sheetField} defaultValue={data.todayValue} name="issuedAt" type="date" />
        </label>
        <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          Vence
          <input className={sheetField} name="dueAt" type="date" />
        </label>
        {isMerchandise ? (
          <SelectField label="Entra en" name="branchId">
            <option value="">Sin impacto en stock</option>
            {data.purchaseBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </SelectField>
        ) : null}
        <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          Total del comprobante
          <MoneyInput className={sheetField} name="declaredTotal" placeholder="Opcional" />
          <span className="text-xs font-medium normal-case tracking-normal text-slate-400">
            Lo que dice el papel. Si no cierra con los renglones, avisamos.
          </span>
        </label>
        {/* El IVA solo tiene sentido para quien lo recupera. A un monotributista
            preguntárselo es ruido: para él el IVA es parte del costo. */}
        {data.showsVat ? (
          <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
            IVA discriminado
            <MoneyInput className={sheetField} name="taxAmount" placeholder="Opcional" />
            <span className="text-xs font-medium normal-case tracking-normal text-slate-400">
              Es crédito fiscal: no cuenta como costo.
            </span>
          </label>
        ) : null}
      </div>

      <div className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">Qué te trajo</span>
        <p className="text-xs font-medium normal-case tracking-normal text-slate-400">
          {isMerchandise
            ? "Si elegís un producto con stock y una sucursal, la mercadería entra sola."
            : "Describí el servicio y poné el importe en el costo."}
        </p>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3" key={index}>
              {isMerchandise ? (
                <select aria-label="Producto" className={`w-full appearance-none ${sheetField}`} name="itemProductId">
                  <option value="">— Ítem sin producto —</option>
                  {data.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input name="itemProductId" type="hidden" value="" />
              )}
              <input aria-label="Descripción" className={sheetField} name="itemDescription" placeholder="Descripción" />
              <div className="grid grid-cols-3 gap-2">
                <input
                  aria-label="Cantidad"
                  className={sheetField}
                  inputMode="decimal"
                  name="itemQuantity"
                  placeholder="Cant."
                />
                <select aria-label="Unidad" className={`appearance-none ${sheetField}`} name="itemUnit">
                  {data.units.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
                <MoneyInput aria-label="Costo unitario" className={sheetField} name="itemUnitCost" placeholder="Costo $" />
              </div>
            </div>
          ))}
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-black text-slate-600 transition active:scale-[0.99]"
          onClick={() => setRows((current) => current + 1)}
          type="button"
        >
          <Plus className="size-4" />
          Agregar renglón
        </button>
      </div>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Notas (opcional)
        <input className={sheetField} name="notes" placeholder="Remito 123" />
      </label>
    </div>
  );
}

export function ExpensesManager({ data }: { data: ExpensesData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [payableId, setPayableId] = useState<string | null>(null);

  const editing = data.outflows.find((row) => row.id === editId && row.kind === "EXPENSE") ?? null;
  const payable = data.payables.find((row) => row.id === payableId) ?? null;

  // Toda mutación se queda en esta ruta, así que devuelve resultado y acá se
  // pide el árbol de nuevo. Ver el comentario en actions.ts.
  function run(action: (formData: FormData) => Promise<ActionResult>, formData: FormData, onDone?: () => void) {
    startTransition(async () => {
      const result = await action(formData);

      if (result.ok) {
        toast.success(result.message);
        onDone?.();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function submitter(action: (formData: FormData) => Promise<ActionResult>, onDone?: () => void) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      run(action, new FormData(form), () => {
        form.reset();
        onDone?.();
      });
    };
  }

  function goToMonth(monthKey: string) {
    startTransition(() => router.push(`/expenses?month=${monthKey}`, { scroll: false }));
  }

  function openNew() {
    if (data.showsSuppliers) {
      setMenuOpen(true);
    } else {
      setNewExpenseOpen(true);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950 lg:max-w-[1080px] lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">Gastos</h1>
        </div>
        {data.showsSuppliers ? (
          <button
            className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
            onClick={() => setSuppliersOpen(true)}
            type="button"
          >
            Proveedores
          </button>
        ) : null}
      </header>

      {/* Navegador de mes */}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-950/5 lg:mx-auto lg:w-full lg:max-w-sm">
        <button
          aria-label="Mes anterior"
          className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-90"
          onClick={() => goToMonth(data.prevMonthKey)}
          type="button"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-black text-slate-950">{data.monthLabel}</span>
        <button
          aria-label="Mes siguiente"
          className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-90"
          onClick={() => goToMonth(data.nextMonthKey)}
          type="button"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Total del mes: gastos + pagos a proveedores, nunca el total de una
          factura que todavía no se pagó. */}
      <div className="mt-3 rounded-[1.5rem] bg-gradient-to-br from-rose-500 to-rose-600 p-5 text-white shadow-lg shadow-rose-500/25">
        <p className="flex items-center gap-1.5 text-sm font-medium text-rose-100">
          <Wallet className="size-4" />
          Total que salió este mes
        </p>
        <p className="mt-1.5 text-[2.2rem] font-black leading-none tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
          {data.totalLabel}
        </p>
        <p className="mt-2 text-xs font-medium text-rose-100">
          {data.count} {data.count === 1 ? "movimiento" : "movimientos"}
        </p>
      </div>

      {/* Lo que se debe no depende del mes que se esté mirando. */}
      {data.showsSuppliers && data.hasDebt ? (
        <section className="mt-4">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">A pagar</h2>
            <p className="text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
              {data.debtLabel}
              {data.overdueCount > 0 ? <span className="ml-2 text-rose-600">· {data.overdueCount} vencida(s)</span> : null}
            </p>
          </div>
          <ul className="mt-2 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {data.payables.map((row) => (
              <li key={row.id}>
                <button
                  aria-label={`Factura de ${row.supplierName}`}
                  className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 transition active:scale-[0.99] ${
                    row.overdue ? "ring-rose-200" : row.dueSoon ? "ring-amber-200" : "ring-slate-950/5"
                  }`}
                  onClick={() => setPayableId(row.id)}
                  type="button"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{row.supplierName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 font-bold ${
                          row.overdue
                            ? "bg-rose-50 text-rose-700"
                            : row.dueSoon
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.overdue ? "Vencida" : row.dueLabel ? `Vence ${row.dueLabel}` : "Sin vencimiento"}
                      </span>
                      <span className="truncate">{row.number ?? "Sin comprobante"}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.pendingLabel}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Lo que salió, gasto o pago, en una sola lista */}
      <div className={`mt-4 ${isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}`}>
        {data.outflows.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white/50 p-10 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-950/5">
              <Wallet className="size-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-600">Nada salió en {data.monthLabel}</p>
            <p className="mt-1 text-xs text-slate-400">Tocá el botón «+» abajo para registrar lo primero.</p>
          </div>
        ) : (
          <ul className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {data.outflows.map((row, index) => (
              <li
                className="duration-500 animate-in fade-in slide-in-from-bottom-2"
                key={`${row.kind}-${row.id}`}
                style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, animationFillMode: "backwards" }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                  onClick={() => (row.kind === "EXPENSE" ? setEditId(row.id) : setPayableId(row.purchaseId ?? null))}
                  type="button"
                >
                  <span
                    className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl ${
                      row.kind === "EXPENSE" ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    <span className="text-[0.6rem] font-black uppercase leading-none">{row.dateLabel}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{row.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                        {row.accountLabel}
                      </span>
                      <span className="truncate">{row.detail}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.amountLabel}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Qué querés cargar */}
      <BottomSheet onClose={() => setMenuOpen(false)} open={menuOpen}>
        <div className="flex min-h-0 flex-1 flex-col">
          <SheetHeader onClose={() => setMenuOpen(false)} title="Cargar" />
          <div className="grid gap-2.5 px-5 py-5">
            <button
              aria-label="Cargar un gasto"
              className="rounded-2xl bg-slate-50 px-4 py-4 text-left transition active:scale-[0.99]"
              onClick={() => {
                setMenuOpen(false);
                setNewExpenseOpen(true);
              }}
              type="button"
            >
              <p className="text-base font-black text-slate-950">Gasto</p>
              <p className="mt-0.5 text-xs text-slate-500">Plata que ya salió: alquiler, sueldos, una compra al contado.</p>
            </button>
            <button
              aria-label="Cargar una factura de proveedor"
              className="rounded-2xl bg-slate-50 px-4 py-4 text-left transition active:scale-[0.99] disabled:opacity-50"
              disabled={data.suppliers.filter((supplier) => supplier.active).length === 0}
              onClick={() => {
                setMenuOpen(false);
                setNewPurchaseOpen(true);
              }}
              type="button"
            >
              <p className="text-base font-black text-slate-950">Factura de proveedor</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {data.suppliers.filter((supplier) => supplier.active).length === 0
                  ? "Primero cargá un proveedor."
                  : "Queda como deuda hasta que la pagues, y entra al stock."}
              </p>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Nuevo gasto */}
      <BottomSheet onClose={() => setNewExpenseOpen(false)} open={newExpenseOpen}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitter(createExpenseAction, () => setNewExpenseOpen(false))}>
          <SheetHeader onClose={() => setNewExpenseOpen(false)} title="Nuevo gasto" />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            <ExpenseFields data={data} />
          </div>
          <SubmitBar label="Registrar gasto" pending={isPending} />
        </form>
      </BottomSheet>

      {/* Editar gasto */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null}>
        {editing?.expense ? (
          <div className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <SheetHeader onClose={() => setEditId(null)} title="Editar gasto" />
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitter(updateExpenseAction, () => setEditId(null))}>
              <input name="expenseId" type="hidden" value={editing.id} />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
                <ExpenseFields data={data} row={editing.expense} />
              </div>
              <SubmitBar label="Guardar cambios" pending={isPending} />
            </form>
            <div className="px-5 pb-5">
              <form onSubmit={submitter(deleteExpenseAction, () => setEditId(null))}>
                <input name="expenseId" type="hidden" value={editing.id} />
                <ConfirmSubmit
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 transition active:scale-[0.99]"
                  confirmLabel="Sí, borrarlo"
                >
                  <Trash2 className="size-4" />
                  Borrar gasto
                </ConfirmSubmit>
              </form>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      {/* Nueva factura de proveedor */}
      <BottomSheet onClose={() => setNewPurchaseOpen(false)} open={newPurchaseOpen}>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={submitter(createPurchaseAction, () => setNewPurchaseOpen(false))}
        >
          <SheetHeader onClose={() => setNewPurchaseOpen(false)} title="Factura de proveedor" />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            <PurchaseFields data={data} />
          </div>
          <SubmitBar label="Cargar factura" pending={isPending} />
        </form>
      </BottomSheet>

      {/* Detalle de una factura */}
      <BottomSheet onClose={() => setPayableId(null)} open={payable !== null} size="dialog">
        {payable ? (
          <div className="flex min-h-0 flex-1 flex-col" key={payable.id}>
            <SheetHeader onClose={() => setPayableId(null)} title={payable.supplierName} />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 px-2 py-3">
                  <p className="text-[0.62rem] font-black uppercase tracking-wide text-slate-400">Total</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{payable.totalLabel}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-2 py-3">
                  <p className="text-[0.62rem] font-black uppercase tracking-wide text-slate-400">Pagado</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{payable.paidLabel}</p>
                </div>
                <div className={`rounded-2xl px-2 py-3 ${payable.overdue ? "bg-rose-50" : "bg-amber-50"}`}>
                  <p className="text-[0.62rem] font-black uppercase tracking-wide text-slate-500">Falta</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{payable.pendingLabel}</p>
                </div>
              </div>

              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                {payable.number ? `Factura ${payable.number}` : "Sin comprobante"}
                {payable.dueLabel ? ` · vence ${payable.dueLabel}` : ""}
                {payable.branchLabel ? ` · ${payable.branchLabel}` : ""}
                {payable.categoryLabel ? ` · ${payable.categoryLabel} (no es mercadería)` : ""}
                {payable.creditedLabel ? ` · ${payable.creditedLabel} en notas de crédito` : ""}
              </p>

              {payable.items.length > 0 ? (
                <div className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Qué trajo</span>
                  {payable.items.map((item) => (
                    <div className="flex items-baseline justify-between gap-3 text-sm" key={item.id}>
                      <span className="min-w-0 truncate font-semibold text-slate-700">{item.label}</span>
                      <span className="shrink-0 text-xs text-slate-400">{item.quantityLabel}</span>
                      <span className="shrink-0 font-black text-slate-950">{item.totalLabel}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {payable.payments.length > 0 ? (
                <div className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Pagos</span>
                  {payable.payments.map((payment) => (
                    <div className="flex items-baseline justify-between gap-3 text-sm" key={payment.id}>
                      <span className="text-slate-500">
                        {payment.dateLabel} · {payment.accountLabel}
                      </span>
                      <span className="font-black text-slate-950">{payment.amountLabel}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <form className="grid gap-2" onSubmit={submitter(payPurchaseAction, () => setPayableId(null))}>
                <input name="purchaseId" type="hidden" value={payable.id} />
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Pagar</span>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white">
                  <span className="text-xl font-black text-slate-400">$</span>
                  <MoneyInput
                    aria-label="Importe a pagar"
                    className="w-full bg-transparent px-2 py-3 text-xl font-black text-slate-950 outline-none"
                    defaultValue={payable.pending}
                    name="amount"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select aria-label="Cuenta" className={`appearance-none ${sheetField}`} name="method">
                    {data.paymentMethods.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input aria-label="Fecha del pago" className={sheetField} defaultValue={data.todayValue} name="paidAt" type="date" />
                </div>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Registrar pago
                </button>
              </form>

              {/* Nota de crédito: baja la deuda sin mover plata. Sin esto, el
                  único arreglo era pagar de menos y dejar la factura en "pago
                  parcial" para siempre. */}
              <details className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">
                  Nota de crédito
                </summary>
                <form className="mt-3 grid gap-2" onSubmit={submitter(creditPurchaseAction, () => setPayableId(null))}>
                  <input name="purchaseId" type="hidden" value={payable.id} />
                  <p className="text-xs text-slate-500">
                    Te bonificaron o devolviste mercadería: baja lo que le debés, sin sacar plata de la caja.
                  </p>
                  <MoneyInput aria-label="Importe de la nota de crédito" className={sheetField} name="amount" placeholder="$" />
                  <div className="grid grid-cols-2 gap-2">
                    <input aria-label="Nº de la nota" className={sheetField} name="number" placeholder="Nº" />
                    <input aria-label="Fecha" className={sheetField} defaultValue={data.todayValue} name="issuedAt" type="date" />
                  </div>
                  <input aria-label="Motivo" className={sheetField} name="reason" placeholder="Motivo (opcional)" />
                  <button
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
                    disabled={isPending}
                    type="submit"
                  >
                    Registrar nota de crédito
                  </button>
                </form>
              </details>
            </div>

            <div className="mt-auto flex gap-2 border-t border-slate-100 px-5 pb-5 pt-4">
              {payable.canCancel ? (
                <form className="flex-1" onSubmit={submitter(cancelPurchaseAction, () => setPayableId(null))}>
                  <input name="purchaseId" type="hidden" value={payable.id} />
                  <ConfirmSubmit
                    className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 transition active:scale-[0.99]"
                    confirmLabel="Sí, anularla"
                  >
                    Anular
                  </ConfirmSubmit>
                </form>
              ) : null}
              <form className="flex-1" onSubmit={submitter(deletePurchaseAction, () => setPayableId(null))}>
                <input name="purchaseId" type="hidden" value={payable.id} />
                <ConfirmSubmit
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 transition active:scale-[0.99]"
                  confirmLabel="Sí, borrarla"
                >
                  <Trash2 className="size-4" />
                  Borrar
                </ConfirmSubmit>
              </form>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      {/* Proveedores: el "a quién", igual que Clientes del lado de las ventas */}
      <BottomSheet onClose={() => setSuppliersOpen(false)} open={suppliersOpen} size="dialog">
        <div className="flex min-h-0 flex-1 flex-col">
          <SheetHeader onClose={() => setSuppliersOpen(false)} title="Proveedores" />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            {data.suppliers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-500">
                Todavía no cargaste proveedores.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.suppliers.map((supplier) => (
                  <li className="rounded-2xl bg-slate-50 p-3.5" key={supplier.id}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">{supplier.name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {supplier.contact ?? "Sin datos"} · {supplier.purchaseCount} compra(s)
                          {supplier.active ? "" : " · inactivo"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${
                          supplier.debtLabel ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {supplier.debtLabel ?? "Al día"}
                      </span>
                      <form onSubmit={submitter(deleteSupplierAction)}>
                        <input name="supplierId" type="hidden" value={supplier.id} />
                        <ConfirmSubmit confirmLabel="Sí, eliminar">Eliminar</ConfirmSubmit>
                      </form>
                    </div>

                    {/* Así cobra un distribuidor: pasa, te dice un número y ese
                        número cubre las facturas que quedaron. Cargarlo factura
                        por factura era inventar un trámite que no existe. */}
                    {supplier.debtLabel ? (
                      <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={submitter(paySupplierAction)}>
                        <input name="supplierId" type="hidden" value={supplier.id} />
                        <MoneyInput
                          aria-label={`Pagarle a ${supplier.name}`}
                          className={sheetField}
                          defaultValue={supplier.debt}
                          name="amount"
                          placeholder="$"
                        />
                        <select aria-label="Cuenta" className={`appearance-none ${sheetField}`} name="method">
                          {data.paymentMethods.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
                          disabled={isPending}
                          type="submit"
                        >
                          Pagar todo
                        </button>
                        <p className="text-xs text-slate-400 sm:col-span-3">
                          Se imputa de la factura más vieja a la más nueva.
                        </p>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <form className="grid gap-3 border-t border-slate-100 pt-4" onSubmit={submitter(createSupplierAction)}>
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Nuevo proveedor</span>
              <input className={sheetField} name="name" placeholder="Distribuidora del Centro" required />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={sheetField} name="taxId" placeholder="CUIT" />
                <input className={sheetField} name="phone" placeholder="Teléfono" />
                <input className={sheetField} name="email" placeholder="Email" type="email" />
                <input className={sheetField} name="address" placeholder="Dirección" />
              </div>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
                disabled={isPending}
                type="submit"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Crear proveedor
              </button>
            </form>
          </div>
        </div>
      </BottomSheet>

      <button
        aria-label="Nuevo gasto"
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={openNew}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
