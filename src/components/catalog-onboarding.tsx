"use client";

import { seedPresetCatalogAction } from "@/app/catalog/seed-actions";
import { CatalogScanButton } from "@/components/catalog-scan-button";
import { ArrowRight, Check, DynamicIcon, Loader2, Plus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
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
      {/* Se habla el idioma del rubro, no el de la app: acá dice "productos" en
          una verdulería y "servicios" en una barbería, igual que el título de la
          pantalla. "Catálogo" es palabra nuestra, no del que atiende. */}
      <div className="max-w-md">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Todavía no cargaste tus {catalogPlural.toLowerCase()}
        </h2>
        {/* text-[17px]: el cuerpo de lectura de Apple corre en 17px, no 16 —
            acá es la única línea de copy real de esta pantalla. */}
        <p className="mt-1 text-[17px] leading-snug text-slate-500">
          Sin esto no se puede vender. La forma más rápida es traer los de tu rubro y después ajustar.
        </p>
      </div>

      {/* Las tres salidas NO pesan igual. Para una verdulería, traer los 122 de
          una es la respuesta correcta casi siempre; las otras dos son para el
          que ya tiene su propia lista. Ponerlas como tres pares obliga a
          deliberar sobre algo que tiene respuesta obvia, y el que abre esto por
          primera vez se queda mirando. Así que una manda y las otras esperan. */}
      {presetCount > 0 ? (
        <button
          className="mt-4 flex w-full flex-col gap-3 rounded-2xl bg-white p-5 text-left ring-2 ring-primary transition active:scale-[0.99] disabled:opacity-60"
          disabled={isPending}
          onClick={seedPreset}
          type="button"
        >
          <span className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-white">
              {isPending ? <Loader2 className="size-6 animate-spin" /> : <DynamicIcon className="size-6" name={catalogIcon} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-black leading-tight text-foreground">
                Traer los {catalogPlural.toLowerCase()} de {verticalLabel.toLowerCase()}
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                {isPending
                  ? "Cargando…"
                  : `${presetCount} ${presetCount === 1 ? catalogSingular.toLowerCase() : catalogPlural.toLowerCase()} con precios sugeridos${presetHasStock ? " y existencia inicial" : ""}.`}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-primary" />
          </span>

          {presetSample.length > 0 ? (
            <span className="block truncate text-xs text-slate-400">
              {presetSample.join(" · ")}
              {presetCount > presetSample.length ? ` · y ${presetCount - presetSample.length} más` : ""}
            </span>
          ) : null}

          {/* Lo que necesita alguien que nunca usó un sistema: saber que no se
              rompe nada. Sin esto, el botón grande da miedo y no lo toca. */}
          <span className="flex items-start gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs leading-5 text-primary">
            <Check className="mt-0.5 size-3.5 shrink-0" />
            Podés cambiar los precios, borrar lo que no vendas y agregar lo tuyo cuando quieras.
          </span>
        </button>
      ) : null}

      <p className="mt-5 text-xs font-black uppercase tracking-[0.08em] text-slate-400">O cargalos vos</p>

      <div className="mt-2 space-y-2">
        {/* Escanear solo tiene sentido donde hay códigos que leer: un corte de
            pelo no viene con código de barras. */}
        {features.barcodes ? (
          <CatalogScanButton
            branchId={branchId}
            categories={categories}
            renderTrigger={(open) => (
              <OptionCard
                icon={<DynamicIcon className="size-5" name="solar:qr-code-bold" />}
                onClick={open}
                subtitle="Apuntás la cámara al código y completás el resto"
                title="Escanear códigos de barras"
              />
            )}
            units={units}
          />
        ) : null}

        <OptionCard
          icon={<Plus className="size-5" />}
          onClick={onCreateManually}
          subtitle="Uno por uno, con su nombre y su precio"
          title="Cargar a mano"
        />
      </div>
    </div>
  );
}

type OptionCardProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
};

// Las opciones secundarias: mismo alto, sin relleno de color, sin aro. Se leen
// como alternativas, no como tres caminos equivalentes.
function OptionCard({ icon, title, subtitle, onClick }: OptionCardProps) {
  return (
    <button
      className="flex w-full items-center gap-3.5 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-950/5 transition hover:ring-slate-950/15 active:scale-[0.99]"
      onClick={onClick}
      type="button"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{subtitle}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-300" />
    </button>
  );
}
