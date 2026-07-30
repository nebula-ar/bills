"use client";

import { seedPresetCatalogAction } from "@/app/catalog/seed-actions";
import { CatalogScanButton } from "@/components/catalog-scan-button";
import { Check, DynamicIcon, Loader2, Plus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

// Primer paso adentro de la app: el catálogo está vacío y hay que llenarlo.
//
// Esto antes pasaba en el registro, entre el email y la contraseña, y era el
// peor momento para preguntarlo: el tipo todavía no vio el sistema y ya le
// pedimos que decida precios. Acá, en cambio, está parado en su catálogo vacío
// y las tres salidas tienen sentido:
//   1. arrancar con lo típico del rubro y después corregir precios,
//   2. escanear la mercadería que tiene en el mostrador,
//   3. cargar uno a mano.

export type CatalogOnboardingProps = {
  branchId: string;
  categories: { id: string; name: string }[];
  units: { value: string; label: string }[];
  catalogIcon: string;
  // Sin códigos de barras no ofrecemos escanear: no hay nada que leer.
  features: { barcodes: boolean };
  catalogSingular: string;
  catalogPlural: string;
  // Rubro y ejemplos de lo que se cargaría de una. Vacío = el rubro no sugiere
  // nada (ver "Otro comercio") y no ofrecemos ese camino.
  verticalLabel: string;
  presetSample: string[];
  presetCount: number;
  // Si el rubro sugiere mercadería, el catálogo nace con stock. Una barbería
  // carga servicios: prometerle "existencia inicial" sería mentirle.
  presetHasStock: boolean;
  onCreateManually: () => void;
};

export function CatalogOnboarding({
  branchId,
  categories,
  units,
  catalogIcon,
  features,
  catalogSingular,
  catalogPlural,
  verticalLabel,
  presetSample,
  presetCount,
  presetHasStock,
  onCreateManually,
}: CatalogOnboardingProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function seedPreset() {
    startTransition(async () => {
      const result = await seedPresetCatalogAction(branchId);

      if (result.ok) {
        toast.success(`${result.created} ${catalogPlural.toLowerCase()} cargados. Revisá los precios.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="mt-6 duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-20 items-center justify-center rounded-[1.75rem] bg-white text-blue-600 shadow-sm ring-1 ring-slate-950/5">
          <DynamicIcon className="size-9" name={catalogIcon} />
        </div>
        <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950">
          Tu catálogo está vacío
        </h2>
        <p className="mt-1.5 max-w-sm text-sm font-semibold leading-6 text-slate-500">
          Sin {catalogPlural.toLowerCase()} no podés vender. Elegí por dónde arrancar: después cambiás todo lo que
          quieras.
        </p>
      </div>

      <div className="mt-6 space-y-2.5">
        {presetCount > 0 ? (
          <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
                <DynamicIcon className="size-5" name={catalogIcon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-950">Cargar los típicos de {verticalLabel.toLowerCase()}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {presetCount} {presetCount === 1 ? catalogSingular.toLowerCase() : catalogPlural.toLowerCase()} con
                  precio de referencia
                  {presetHasStock ? ", unidad de venta y existencia inicial" : ""}.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {presetSample.map((name) => (
                    <span
                      className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600"
                      key={name}
                    >
                      {name}
                    </span>
                  ))}
                  {presetCount > presetSample.length ? (
                    <span className="px-1 py-1 text-xs font-bold text-slate-400">
                      y {presetCount - presetSample.length} más
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
              disabled={isPending}
              onClick={seedPreset}
              type="button"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Cargar y revisar precios
            </button>
          </div>
        ) : null}

        {/* Escanear solo tiene sentido donde hay códigos que leer: un corte de
            pelo no viene con código de barras. */}
        {features.barcodes ? (
          <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
                <DynamicIcon className="size-5" name="solar:qr-code-bold" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-950">Escanear lo que tenés en el mostrador</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Apuntás al código de barras y te preguntamos precio, costo y stock. Guarda la foto de paso.
                </p>
              </div>
            </div>
            <div className="mt-3 [&>button]:w-full [&>button]:justify-center [&>button]:rounded-2xl [&>button]:py-3.5">
              <CatalogScanButton branchId={branchId} categories={categories} units={units} />
            </div>
          </div>
        ) : null}

        <button
          className="flex w-full items-center gap-3 rounded-[1.5rem] bg-white p-4 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
          onClick={onCreateManually}
          type="button"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <Plus className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-slate-950">Cargar uno a mano</span>
            <span className="block text-xs text-slate-500">
              Nombre y precio, y listo. Es lo más rápido si tenés pocos {catalogPlural.toLowerCase()}.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
