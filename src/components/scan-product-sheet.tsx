"use client";

import { createProductFromScan } from "@/app/catalog/scan-actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Check, Loader2, X } from "@/components/icons";
import { formatAmountInput } from "@/lib/money";
import { unitLabel } from "@/lib/quantity";
import { useState, useTransition } from "react";

// Alta guiada de un producto recién escaneado.
//
// Va de a un dato por paso, como el alta del negocio: quien carga mercadería
// está parado con una caja en la mano y el celular en la otra. Un formulario con
// diez campos se abandona; cuatro preguntas grandes, no.
//
// El orden no es casual: primero lo que no se puede adivinar (nombre y precio),
// después lo que se puede completar más tarde (costo, stock). Se puede terminar
// en cualquier momento con "Listo".

type Category = { id: string; name: string };

type ScanProductSheetProps = {
  open: boolean;
  code: string;
  branchId: string;
  categories: Category[];
  units: { value: string; label: string }[];
  // Foto tomada con la misma cámara al escanear.
  photo: File | null;
  photoPreview: string | null;
  // La foto ya existe online (la trajo el código): la baja el servidor, no se sube.
  photoFromDirectory: boolean;
  // Nombre que trajo el código de la base pública de productos. Puede ser "".
  suggestedName: string;
  onClose: () => void;
  onCreated: (productId: string, name: string) => void;
};

const STEPS = [
  { key: "name", title: "¿Qué producto es?", hint: "El nombre con el que lo vas a buscar." },
  { key: "price", title: "¿A cuánto lo vendés?", hint: "El precio que le cobrás al cliente." },
  { key: "cost", title: "¿Cuánto te costó?", hint: "Sirve para saber tu ganancia. Podés saltearlo." },
  { key: "stock", title: "¿Cuántos tenés?", hint: "La existencia con la que arranca. Podés saltearlo." },
  { key: "extra", title: "Un par de datos más", hint: "Todo esto es opcional." },
] as const;

const input =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-black text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15";

export function ScanProductSheet({
  open,
  code,
  branchId,
  categories,
  units,
  photo,
  photoPreview,
  photoFromDirectory,
  suggestedName,
  onClose,
  onCreated,
}: ScanProductSheetProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(suggestedName);
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("UNIT");
  const [minStock, setMinStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  // La foto de la cámara se puede descartar: apuntando al código, muchas veces
  // lo que sale es el código y no el producto.
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [isPending, startTransition] = useTransition();

  const showPhoto = Boolean(photoPreview) && (photoFromDirectory || keepPhoto);

  const meta = STEPS[step];
  const isLast = step === STEPS.length - 1;
  // Solo el nombre y el precio son obligatorios: el resto se puede completar después.
  const canAdvance = step === 0 ? name.trim().length > 0 : step === 1 ? Number(price) > 0 : true;

  function reset() {
    setStep(0);
    setName(suggestedName);
    setPrice("");
    setCost("");
    setStock("");
    setUnit("UNIT");
    setMinStock("");
    setCategoryId("");
    setError(null);
    setKeepPhoto(true);
  }

  function close() {
    reset();
    onClose();
  }

  function next() {
    setError(null);
    if (!canAdvance) return;
    if (isLast) {
      submit();
      return;
    }
    setStep((current) => current + 1);
  }

  function submit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", code);
      formData.set("branchId", branchId);
      formData.set("name", name);
      formData.set("price", price);
      formData.set("cost", cost);
      formData.set("stock", stock);
      formData.set("unit", unit);
      formData.set("minStock", minStock);
      formData.set("categoryId", categoryId);

      if (photoFromDirectory) {
        formData.set("directoryPhoto", "1");
      } else if (photo && keepPhoto) {
        formData.set("photo", photo);
      }

      const result = await createProductFromScan(formData);

      if (result.ok) {
        const created = name.trim();
        reset();
        onCreated(result.productId, created);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <BottomSheet onClose={close} open={open} panelClassName="min-h-[72dvh]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3 px-5 pt-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-primary">
              Producto nuevo · {step + 1}/{STEPS.length}
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{meta.title}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{meta.hint}</p>
          </div>
          <button
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
            onClick={close}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
          {/* El código y la foto viajan con el alta: se ven siempre, para que
              quede claro qué se está cargando. */}
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            {showPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-14 shrink-0 rounded-xl bg-white object-contain" src={photoPreview ?? ""} />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Código escaneado</p>
              <p className="truncate font-mono text-sm font-bold text-slate-700">{code || "sin código"}</p>
              {photoFromDirectory ? (
                <p className="mt-0.5 text-xs font-bold text-emerald-600">Foto y nombre traídos del código</p>
              ) : null}
            </div>

            {/* Sin foto de la base queda la de la cámara, que suele ser el propio
                código de barras. Se puede tirar de un toque. */}
            {photoPreview && !photoFromDirectory && keepPhoto ? (
              <button
                className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm transition active:scale-95"
                onClick={() => setKeepPhoto(false)}
                type="button"
              >
                Quitar foto
              </button>
            ) : null}
          </div>

          {step === 0 ? (
            <input
              className={input}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && next()}
              placeholder="Ej: Alfajor triple"
              value={name}
            />
          ) : null}

          {step === 1 ? (
            <label className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white">
              <span className="text-2xl font-black text-slate-400">$</span>
              <input
                className="w-full bg-transparent px-2 py-4 text-center text-2xl font-black text-slate-950 outline-none"
                inputMode="numeric"
                onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
                onKeyDown={(event) => event.key === "Enter" && next()}
                placeholder="0"
                value={formatAmountInput(price)}
              />
            </label>
          ) : null}

          {step === 2 ? (
            <>
              <label className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white">
                <span className="text-2xl font-black text-slate-400">$</span>
                <input
                  className="w-full bg-transparent px-2 py-4 text-center text-2xl font-black text-slate-950 outline-none"
                  inputMode="numeric"
                  onChange={(event) => setCost(event.target.value.replace(/\D/g, ""))}
                  onKeyDown={(event) => event.key === "Enter" && next()}
                  placeholder="0"
                  value={formatAmountInput(cost)}
                />
              </label>
              {Number(price) > 0 && Number(cost) > 0 ? (
                <p className="text-center text-sm font-bold text-emerald-600">
                  Ganás {Math.round(((Number(price) - Number(cost)) / Number(price)) * 100)}% por unidad
                </p>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-3">
              <input
                className={input}
                inputMode="decimal"
                onChange={(event) => setStock(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && next()}
                placeholder="0"
                value={stock}
              />
              <div className="grid grid-cols-3 gap-2">
                {units.slice(0, 6).map((option) => (
                  <button
                    className={`rounded-xl px-2 py-2.5 text-xs font-black transition active:scale-95 ${
                      unit === option.value ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                    }`}
                    key={option.value}
                    onClick={() => setUnit(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                Categoría
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none"
                  onChange={(event) => setCategoryId(event.target.value)}
                  value={categoryId}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                Avisarme cuando queden menos de
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none"
                  inputMode="decimal"
                  onChange={(event) => setMinStock(event.target.value)}
                  placeholder={`Ej: 5 ${unitLabel(unit as never).toLowerCase()}`}
                  value={minStock}
                />
              </label>
            </div>
          ) : null}

          {error ? <p className="text-center text-sm font-bold text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 px-5 pb-1 pt-4">
          {step > 0 ? (
            <button
              className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-black text-slate-600 transition active:scale-95"
              onClick={() => setStep((current) => current - 1)}
              type="button"
            >
              Atrás
            </button>
          ) : null}

          {/* A partir del precio ya se puede guardar: el resto es opcional. */}
          {step >= 2 && !isLast ? (
            <button
              className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-black text-slate-600 transition active:scale-95"
              disabled={isPending}
              onClick={submit}
              type="button"
            >
              Listo
            </button>
          ) : null}

          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
            disabled={!canAdvance || isPending}
            onClick={next}
            type="button"
          >
            {isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Guardando…
              </>
            ) : isLast ? (
              <>
                <Check className="size-5" />
                Crear producto
              </>
            ) : (
              "Continuar"
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
