"use client";

import { createVariantsAction } from "@/app/catalog/variant-actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, Loader2, X } from "@/components/icons";
import { formatAmountInput } from "@/lib/money";
import { generateVariants, parseAxisValues } from "@/modules/catalog/variants.logic";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SelectField } from "@/components/ui/select-field";

// Alta de un modelo con talles y colores.
//
// La vista previa en vivo no es adorno: crear 15 productos es una operación que
// no se deshace de un toque, así que quien la dispara tiene que ver exactamente
// qué va a quedar antes de apretar.

const SIZE_PRESETS = [
  { label: "Ropa", values: "S, M, L, XL" },
  { label: "Numérico", values: "38, 40, 42, 44" },
  { label: "Calzado", values: "37, 38, 39, 40, 41, 42" },
];

const input =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white";

export function VariantGenerator({
  branchId,
  categories,
}: {
  branchId: string;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // La misma función que usa el servidor: lo que se ve es lo que se crea.
  const preview = useMemo(
    () =>
      generateVariants(modelName, [
        { name: "Talle", values: parseAxisValues(sizes) },
        { name: "Color", values: parseAxisValues(colors) },
      ]),
    [modelName, sizes, colors],
  );

  const canCreate = modelName.trim().length > 0 && Number(price) > 0 && preview.length > 0 && preview.length <= 100;

  function submit() {
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("branchId", branchId);
      formData.set("modelName", modelName);
      formData.set("sizes", sizes);
      formData.set("colors", colors);
      formData.set("price", price);
      formData.set("cost", cost);
      formData.set("stock", stock);
      formData.set("categoryId", categoryId);

      const result = await createVariantsAction(formData);

      if (result.ok) {
        toast.success(`${result.created} variantes creadas.`);
        setOpen(false);
        setModelName("");
        setSizes("");
        setColors("");
        setPrice("");
        setCost("");
        setStock("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition active:scale-95"
        onClick={() => setOpen(true)}
        type="button"
      >
        Con talles
      </button>

      <BottomSheet onClose={() => setOpen(false)} open={open} panelClassName="min-h-[80dvh]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 px-5 pt-6">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-950">Modelo con variantes</h3>
              <p className="text-sm text-slate-500">
                Cada talle queda como un producto propio, con su código y su stock.
              </p>
            </div>
            <button
              aria-label="Cerrar"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Modelo
              <input
                className={input}
                onChange={(event) => setModelName(event.target.value)}
                placeholder="Ej: Remera lisa"
                value={modelName}
              />
            </label>

            <div className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Talles</span>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition active:scale-95"
                    key={preset.label}
                    onClick={() => setSizes(preset.values)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                className={input}
                onChange={(event) => setSizes(event.target.value)}
                placeholder="S, M, L, XL"
                value={sizes}
              />
            </div>

            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Colores (opcional)
              <input
                className={input}
                onChange={(event) => setColors(event.target.value)}
                placeholder="Negro, Blanco"
                value={colors}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Precio de venta
                <input
                  className={input}
                  inputMode="numeric"
                  onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
                  placeholder="$"
                  value={formatAmountInput(price)}
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Costo (opcional)
                <input
                  className={input}
                  inputMode="numeric"
                  onChange={(event) => setCost(event.target.value.replace(/\D/g, ""))}
                  placeholder="$"
                  value={formatAmountInput(cost)}
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Stock de cada una
                <input
                  className={input}
                  inputMode="numeric"
                  onChange={(event) => setStock(event.target.value)}
                  placeholder="0"
                  value={stock}
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Categoría
                <SelectField
                  ariaLabel="Categoría"
                  defaultValue={categoryId}
                  onChange={setCategoryId}
                  options={[
                    { value: "", label: "Sin categoría" },
                    ...categories.map((category) => ({ value: category.id, label: category.name })),
                  ]}
                />
              </label>
            </div>

            {preview.length > 0 ? (
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Se van a crear {preview.length} productos
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preview.slice(0, 24).map((variant) => (
                    <span
                      className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-950/5"
                      key={variant.label}
                    >
                      {variant.label}
                    </span>
                  ))}
                  {preview.length > 24 ? (
                    <span className="px-2 py-1 text-xs font-bold text-slate-400">y {preview.length - 24} más</span>
                  ) : null}
                </div>
                {preview.length > 100 ? (
                  <p className="mt-2 text-xs font-bold text-rose-600">
                    Son demasiadas combinaciones. Cargalas en tandas de hasta 100.
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
          </div>

          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
              disabled={!canCreate || isPending}
              onClick={submit}
              type="button"
            >
              {isPending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              Crear {preview.length > 0 ? `${preview.length} productos` : "variantes"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
