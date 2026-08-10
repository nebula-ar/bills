"use client";

import { createQuoteAction } from "@/app/presupuestos/actions";
import { AnimatedMoney } from "@/components/animated-number";
import { Check, Loader2, Plus, Trash2 } from "@/components/icons";
import { inputClass } from "@/components/manager-ui";
import { Unit } from "@/generated/prisma/enums";
import { formatAmountInput } from "@/lib/money";
import { formatQuantity, lineTotal, ONE, parseQuantityInput, unitShort } from "@/lib/quantity";
import { quoteTotals } from "@/modules/quotes/quote.logic";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/ui/select-field";

// Armador de presupuestos.
//
// Dos cosas que no son negociables acá: se puede escribir un renglón a mano
// (la mano de obra y el flete son la mitad de lo que se cotiza y no están en el
// catálogo), y el total se ve mientras se arma, porque la pregunta del cliente
// al teléfono es "¿cuánto me sale todo?".

export type QuoteProduct = { id: string; name: string; price: number; unit: Unit };
export type QuoteBranch = { id: string; name: string; products: QuoteProduct[] };
export type QuoteCustomer = { id: string; name: string; phone: string | null };

type Line = {
  key: number;
  productId: string | null;
  description: string;
  // Texto tal como lo tipea el usuario ("1,5"); se convierte a milésimas al guardar.
  quantity: string;
  unit: Unit;
  unitPrice: string;
};

let nextKey = 1;

function emptyLine(): Line {
  return { key: nextKey++, productId: null, description: "", quantity: "1", unit: Unit.UNIT, unitPrice: "" };
}

export function QuoteBuilder({
  branches,
  customers,
  defaultValidUntil,
}: {
  branches: QuoteBranch[];
  customers: QuoteCustomer[];
  // "YYYY-MM-DD" calculado en el servidor: la fecha del navegador puede estar corrida.
  defaultValidUntil: string;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [isPending, startTransition] = useTransition();

  const branch = branches.find((item) => item.id === branchId) ?? branches[0];
  const products = branch?.products ?? [];

  const parsed = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        quantityMilli: parseQuantityInput(line.quantity, line.unit) ?? 0,
        price: Number(line.unitPrice.replace(/\D/g, "")) || 0,
      })),
    [lines],
  );

  // El mismo cálculo que hace el servidor al guardar.
  const totals = quoteTotals(
    parsed
      .filter((line) => line.description.trim().length > 0)
      .map((line) => ({ quantity: line.quantityMilli, unitPrice: line.price })),
    Number(discount.replace(/\D/g, "")) || 0,
  );

  function patch(key: number, changes: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  // Elegir un producto del catálogo trae nombre, precio y unidad; después se
  // puede tocar todo, porque cotizar 200 metros no se hace al precio de lista.
  function pickProduct(key: number, productId: string) {
    const product = products.find((item) => item.id === productId);

    if (!product) {
      patch(key, { productId: null });
      return;
    }

    patch(key, {
      productId: product.id,
      description: product.name,
      unit: product.unit,
      unitPrice: String(product.price),
    });
  }

  function submit() {
    const payload = parsed
      .filter((line) => line.description.trim().length > 0 && line.quantityMilli > 0)
      .map((line) => ({
        productId: line.productId,
        description: line.description,
        quantity: line.quantityMilli,
        unit: line.unit,
        unitPrice: line.price,
      }));

    if (payload.length === 0) {
      toast.error("Agregá al menos un renglón con descripción y cantidad.");
      return;
    }

    startTransition(async () => {
      const result = await createQuoteAction({
        branchId,
        customerId: customerId || undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        lines: payload,
        discount: Number(discount.replace(/\D/g, "")) || 0,
        notes: notes || undefined,
        validUntil,
      });

      if (result.ok) {
        toast.success(`Presupuesto #${result.number} guardado.`);
        router.push("/presupuestos");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.length > 1 ? (
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            Sucursal
            <SelectField
              ariaLabel="Sucursal"
              defaultValue={branchId}
              onChange={setBranchId}
              options={branches.map((item) => ({ value: item.id, label: item.name }))}
            />
          </label>
        ) : null}

        {customers.length > 0 ? (
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            Cliente de la ficha
            <SelectField
              ariaLabel="Cliente"
              defaultValue={customerId}
              onChange={(value) => {
                setCustomerId(value);
                const found = customers.find((item) => item.id === value);
                if (found) {
                  setCustomerName("");
                  setCustomerPhone(found.phone ?? "");
                }
              }}
              options={[
                { value: "", label: "Sin cliente cargado" },
                ...customers.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </label>
        ) : null}

        {customerId ? null : (
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
            ¿Para quién es?
            <input
              className={inputClass}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Ej: Obra Belgrano"
              value={customerName}
            />
          </label>
        )}

        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
          Teléfono
          <input
            className={inputClass}
            onChange={(event) => setCustomerPhone(event.target.value)}
            placeholder="11 5555-5555"
            value={customerPhone}
          />
        </label>

        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
          Vale hasta
          <input
            className={inputClass}
            onChange={(event) => setValidUntil(event.target.value)}
            type="date"
            value={validUntil}
          />
        </label>
      </div>

      <div className="space-y-2.5">
        {lines.map((line) => {
          const quantityMilli = parseQuantityInput(line.quantity, line.unit) ?? 0;
          const price = Number(line.unitPrice.replace(/\D/g, "")) || 0;

          return (
            <div className="rounded-2xl border border-slate-200 p-3" key={line.key}>
              <div className="grid gap-2 sm:grid-cols-[1.6fr_repeat(3,minmax(0,1fr))_auto]">
                <div className="grid gap-1.5">
                  <SelectField
                    ariaLabel="Producto del catálogo"
                    defaultValue={line.productId ?? ""}
                    onChange={(value) => pickProduct(line.key, value)}
                    options={[
                      { value: "", label: "Renglón libre (mano de obra, flete…)" },
                      ...products.map((product) => ({ value: product.id, label: product.name })),
                    ]}
                  />
                  <input
                    aria-label="Descripción"
                    className={inputClass}
                    onChange={(event) => patch(line.key, { description: event.target.value })}
                    placeholder="Qué se cotiza"
                    value={line.description}
                  />
                </div>

                <input
                  aria-label="Cantidad"
                  className={inputClass}
                  inputMode="decimal"
                  onChange={(event) => patch(line.key, { quantity: event.target.value })}
                  placeholder="Cantidad"
                  value={line.quantity}
                />

                <input
                  aria-label="Precio unitario"
                  className={inputClass}
                  inputMode="numeric"
                  onChange={(event) => patch(line.key, { unitPrice: event.target.value.replace(/\D/g, "") })}
                  placeholder={`$ por ${unitShort(line.unit)}`}
                  value={formatAmountInput(line.unitPrice)}
                />

                <div className="flex items-center justify-end px-1 text-sm font-black text-slate-950 sm:justify-center">
                  {money(lineTotal(quantityMilli, price))}
                </div>

                <button
                  aria-label="Quitar renglón"
                  className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition active:scale-90"
                  onClick={() =>
                    setLines((current) => (current.length > 1 ? current.filter((item) => item.key !== line.key) : current))
                  }
                  type="button"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {quantityMilli > 0 && quantityMilli !== ONE ? (
                <p className="mt-1.5 text-xs font-bold text-slate-400">
                  {formatQuantity(quantityMilli, line.unit)} × {money(price)}
                </p>
              ) : null}
            </div>
          );
        })}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-black text-slate-600 transition active:scale-[0.99]"
          onClick={() => setLines((current) => [...current, emptyLine()])}
          type="button"
        >
          <Plus className="size-4" />
          Agregar renglón
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
          Descuento
          <input
            className={inputClass}
            inputMode="numeric"
            onChange={(event) => setDiscount(event.target.value.replace(/\D/g, ""))}
            placeholder="$"
            value={formatAmountInput(discount)}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
          Nota para el cliente
          <input
            className={inputClass}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="No incluye instalación"
            value={notes}
          />
        </label>
      </div>

      <div className="rounded-2xl bg-slate-950 p-4 text-white">
        <div className="flex items-center justify-between text-sm font-bold text-white/60">
          <span>Subtotal</span>
          <span data-testid="quote-subtotal">{money(totals.subtotal)}</span>
        </div>
        {totals.discountTotal > 0 ? (
          <div className="mt-1 flex items-center justify-between text-sm font-bold text-emerald-300">
            <span>Descuento</span>
            <span>−{money(totals.discountTotal)}</span>
          </div>
        ) : null}
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm font-black uppercase tracking-wide text-white/60">Total</span>
          {/* Count-up corto: el total es lo que el cliente mira mientras se
              arma la cotización. Cuenta desde el valor anterior (ver
              useCountUp), así un cambio de renglón "respira" y no parpadea. */}
          <span className="text-3xl font-black tracking-tight" data-testid="quote-total">
            <AnimatedMoney durationMs={500} value={totals.total} />
          </span>
        </div>
      </div>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
        disabled={isPending || totals.total <= 0}
        onClick={submit}
        type="button"
      >
        {isPending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
        Guardar presupuesto
      </button>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}
