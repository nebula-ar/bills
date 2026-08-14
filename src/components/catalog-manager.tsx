"use client";

import { createProduct, toggleProductAvailability, updateProductDetails, uploadProductImage } from "@/app/catalog/actions";
import { applyProductStockAction } from "@/app/catalog/stock-actions";
import { transferStockAction } from "@/app/stock/actions";
import { resizeImageForUpload } from "@/lib/image-resize";
import { parseAmountInput } from "@/lib/money";
import { newProductSteps, puedeAvanzar } from "@/modules/catalog/new-product-steps.logic";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SidePanel } from "@/components/ui/side-panel";
import { Reveal } from "@/components/reveal";
import { MoneyInput } from "@/components/money-input";
import { CatalogScanButton } from "@/components/catalog-scan-button";
import { VariantGenerator } from "@/components/variant-generator";
import { CatalogOnboarding } from "@/components/catalog-onboarding";
import { ProductStockPanel } from "@/components/product-stock-panel";
import { ProductPhotoField } from "@/components/product-photo-field";
import { ProductAnalyticsTab } from "@/components/product-analytics-tab";
import { AnimatedMoney } from "@/components/animated-number";
import { RefreshActionForm } from "@/components/refresh-action-form";
import { formatQuantity, QUANTITY_SCALE, unitLabel } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  DynamicIcon,
  History,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from "@/components/icons";
import { SelectField } from "@/components/ui/select-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

export type ProductBranchConfig = {
  branchId: string;
  configured: boolean;
  available: boolean;
  priceValue: string;
};

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  configured: boolean;
  available: boolean;
  priceLabel: string;
  // Precio numérico REAL de esta sucursal (no el sugerido de otra). null si no
  // está configurado. Sirve para ordenar y calcular margen; para MOSTRAR el
  // precio se usa `priceLabel`, que ya resuelve el caso "~ $X" sugerido y el
  // "Sin precio" — no se reformatea acá.
  priceValue: number | null;
  statusLabel: string;
  statusTone: "available" | "unavailable" | "unconfigured";
  branchConfigs: ProductBranchConfig[];
  // Datos comerciales (los usa el rubro que maneja mercadería).
  kind: string;
  unit: string;
  sku: string | null;
  barcode: string | null;
  cost: number | null;
  trackStock: boolean;
  // Mínimo ya formateado en unidades, listo para el input.
  minStockValue: string;
  // Existencia en la sucursal (milésimas). null = no lleva control de stock.
  stockQuantity: number | null;
  // Mínimo en milésimas, para marcar los que hay que reponer.
  minStockRaw: number | null;
  // Venta por bulto: cuántas unidades trae y cómo lo llama el rubro.
  packSize: number | null;
  packLabel: string | null;
  categoryId: string | null;
  // Foto: `imageVersion` es la marca de tiempo que saltea el caché del navegador.
  // `hasPhoto` es solo la foto propia: lo mira el campo de subida, que no puede
  // ofrecer "quitar" sobre una imagen del catálogo que el dueño nunca subió.
  hasPhoto: boolean;
  imageVersion: number | null;
  catalogSlug: string | null;
  // Modelo con talles: se muestra el modelo + la variante.
  familyName: string | null;
  variantLabel: string | null;
  // Promos vigentes que le pegan a este producto. Solo para avisar: el cálculo
  // real lo hace el cobro, porque depende del carrito entero.
  promociones: { id: string; name: string; label: string }[];
};

export type ProductsData = {
  businessName: string;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  products: ProductRow[];
  categories: { id: string; name: string }[];
  units: { value: string; label: string }[];
  // Cómo llama este rubro a lo que vende ("Servicios" / "Productos").
  catalogSingular: string;
  catalogPlural: string;
  // Icono del rubro (ver src/lib/vertical.ts).
  catalogIcon: string;
  // Qué herramientas le sirven a este rubro (ver src/lib/vertical.ts) más el
  // módulo de stock, que decide si el producto muestra su existencia.
  features: { variants: boolean; barcodes: boolean; packs: boolean; stock: boolean };
  // Nombre de la sucursal elegida, para decir "en Sucursal Centro quedan 12".
  selectedBranchName: string;
  // Rubro y catálogo sugerido, para el onboarding del catálogo vacío.
  verticalLabel: string;
  presetSample: string[];
  presetCount: number;
  presetHasStock: boolean;
  flash: { status: "success" | "error"; message: string } | null;
  aiImagesEnabled: boolean;
  // Lo que antes vivía en /stock (retirada: ver src/app/stock/page.tsx en el
  // historial de git, `git show HEAD~N:src/app/stock/page.tsx`). null cuando
  // el módulo Stock está apagado — acá no se pregunta ni se muestra nada de
  // esto en ese caso.
  stockTotals: { products: number; value: number; low: number; out: number } | null;
  stockMovements: {
    id: string;
    productId: string;
    productName: string;
    unit: string;
    // Con signo: negativo = salió, positivo = entró (milésimas).
    quantity: number;
    typeLabel: string;
    reason: string | null;
    when: string;
  }[];
};

// Un solo estilo de campo para toda la ficha. Antes la pestaña de stock usaba
// uno más chico y con otro fondo, así que al cambiar de pestaña los campos
// cambiaban de forma y parecían de otra pantalla.
const sheetInput =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-foreground outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15";

// BottomSheet monta su contenido en un portal a `document.body` (ver
// ui/bottom-sheet.tsx): queda fuera del <main> de esta pantalla en el árbol
// del DOM, así que el override de --primary/--foreground de acá arriba no
// cascadea solo. Sin esto, los sheets de alta y edición se veían con el azul
// y el negro de siempre en vez del Action Blue/ink de esta pantalla.
// --primary-strong igual a --primary a propósito: Apple no oscurece en
// hover/press, usa transform: scale(0.95) como toda la marca de estado.
const sheetVars = "[--primary:#0066cc] [--primary-strong:#0066cc] [--foreground:#1d1d1f] [--background:#f5f5f7]";

// Nombre y descripción se editan DONDE SE LEEN: el título del panel es el
// input del nombre, no un título arriba y un campo "Nombre" repitiéndolo más
// abajo. Cuando eran dos cosas, tipear en el campo no cambiaba el título, así
// que la misma pantalla mostraba dos valores distintos para el mismo dato.
// Sin borde en reposo para que se lean como texto; fondo y anillo al pasar el
// mouse o enfocar, que es lo que avisa que se pueden tocar.
const identityTitleInput =
  "-mx-2 w-full rounded-xl bg-transparent px-2 py-1 text-2xl font-semibold leading-tight tracking-tight text-foreground outline-none transition hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-primary";
const identityNoteInput =
  "-mx-2 w-full rounded-xl bg-transparent px-2 py-1 text-base leading-relaxed text-slate-500 outline-none transition hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-primary";

// Título de campo y su renglón de ayuda. El título va corto para que entre en
// una línea —en mayúsculas, una frase larga es lo que peor se lee— y lo que
// haga falta explicar baja al renglón de ayuda, en minúscula y sin negrita.
const fieldLabel = "text-sm font-black uppercase tracking-wide text-slate-500";
const fieldHint = "text-sm leading-snug text-slate-500";

// Título de grupo. Tiene que verse DISTINTO del título de campo: con el mismo
// tratamiento (chico, mayúsculas, gris) "Cómo se vende" y "Tipo" se leían como
// dos campos seguidos y la agrupación no separaba nada.
const sectionLabel = "text-base font-black text-foreground";


const toneClasses: Record<ProductRow["statusTone"], string> = {
  available: "bg-emerald-50 text-emerald-700",
  unavailable: "bg-slate-100 text-slate-500",
  unconfigured: "bg-amber-50 text-amber-700",
};

// ─────────────────────────────────────────────────────────────────────────
// Productos + Stock unificados: helpers puros y constantes compartidas por
// la tabla de escritorio, el panel rápido y las cards de mobile.
// ─────────────────────────────────────────────────────────────────────────

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function money(value: number): string {
  return moneyFormatter.format(value);
}

// Margen sobre precio: (1 - costo/precio). Null si falta cualquiera de los
// dos datos o el precio no es válido — nunca se inventa un número cuando
// falta costo o precio (mismo espíritu que el resto del proyecto con
// `unitCost` faltante, ver AGENTS.md).
function margenPct(cost: number | null, price: number | null): number | null {
  if (cost === null || price === null || price <= 0) return null;
  return Math.round((1 - cost / price) * 100);
}

// Snapshot en texto de la pestaña "Detalles", para saber si hay algo sin
// guardar. Todos estos campos viven en el mismo <form> que Precio/Costo (ver
// ProductQuickPanelBody) y quedan montados aunque la pestaña no esté a la
// vista —ocultos con CSS, no desmontados— así que siempre están en el
// FormData sin importar qué pestaña se esté mirando.
type ProductDetailsSnapshot = {
  name: string;
  description: string;
  kind: string;
  unit: string;
  barcode: string;
  sku: string;
  categoryId: string;
  minStock: string;
  packSize: string;
  packLabel: string;
};

function detailsSnapshotOf(product: ProductRow): ProductDetailsSnapshot {
  return {
    name: product.name,
    description: product.description ?? "",
    kind: product.kind,
    unit: product.unit,
    barcode: product.barcode ?? "",
    sku: product.sku ?? "",
    categoryId: product.categoryId ?? "",
    minStock: product.minStockValue,
    packSize: product.packSize !== null ? String(product.packSize) : "",
    packLabel: product.packLabel ?? "",
  };
}

function readDetailsSnapshot(formData: FormData): ProductDetailsSnapshot {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    name: get("name"),
    description: get("description"),
    kind: get("kind"),
    unit: get("unit"),
    barcode: get("barcode"),
    sku: get("sku"),
    categoryId: get("categoryId"),
    minStock: get("minStock"),
    packSize: get("packSize"),
    packLabel: get("packLabel"),
  };
}

type StockStatus = "out" | "low" | "ok";

// Mutuamente excluyente y con prioridad: sin stock gana aunque también esté
// bajo el mínimo (0 es, por definición, lo más bajo que hay). null = el
// producto no lleva control de stock.
function stockStatusOf(product: ProductRow): StockStatus | null {
  if (product.stockQuantity === null) return null;
  if (product.stockQuantity <= 0) return "out";
  if (product.minStockRaw !== null && product.stockQuantity <= product.minStockRaw) return "low";
  return "ok";
}

// Colores del badge de stock. "Bajo mínimo" usa el tono exacto del diseño
// importado (no hay ranura semántica de "warning" en este proyecto, así que
// va fijo); "sin stock"/"ok" reusan la paleta rose/slate que ya usa el resto
// de esta pantalla — a propósito NO `text-destructive`/`bg-muted`: esos
// tokens los redefine cada rubro (ver `[data-vertical="BAKERY"]` en
// globals.css) y esta pantalla tiene paleta Apple fija, no la del rubro.
const STOCK_BADGE: Record<StockStatus, { badge: string; dot: string }> = {
  out: { badge: "bg-rose-50 text-rose-700", dot: "bg-rose-600" },
  low: { badge: "bg-[#FDF0D5] text-[#8A5A1E]", dot: "bg-[#8A5A1E]" },
  ok: { badge: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

// Tinte determinístico por categoría para el avatar con inicial: mismo
// criterio en toda la fila/panel, sin mapa hardcodeado por nombre (el mock
// tenía uno fijo porque su data de ejemplo era fija; acá las categorías las
// define cada negocio, así que no hay nombres para mapear de antemano).
const AVATAR_TINTS = [
  "bg-primary/10 text-primary",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-teal-100 text-teal-700",
];

function avatarTint(categoryId: string | null): string {
  if (!categoryId) return AVATAR_TINTS[0];
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

// Nulls siempre al final, sin importar la dirección: "sin dato" no es ni lo
// más alto ni lo más bajo, así que no debería aparecer primero en ningún
// sentido de la flecha.
function compareNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
}

type SortKey = "name" | "cost" | "price" | "margin" | "stock";
type SortDir = "asc" | "desc";
type StockFilterValue = "all" | "in" | "low" | "out";
type AvailabilityFilterValue = "all" | "available" | "paused";
type FilterOption<T extends string> = { value: T; label: string; count: number };

// Marca del filtro de categoría reservada para "Insumos" (no puede chocar
// con un categoryId real, que es un cuid). El filtro combinado de mobile usa
// el mismo criterio, con las categorías reales prefijadas para lo mismo.
const CATEGORY_INSUMOS = "__insumos__";
const MOBILE_CATEGORY_PREFIX = "cat:";

// Grid de la tabla de escritorio: avatar / producto / costo / precio / margen
// / [stock] / disponible. La columna Stock se omite entera (header y filas)
// cuando el negocio tiene el módulo apagado — mismo criterio que el resto de
// la pantalla, que no pregunta ni muestra nada de stock en ese caso.
const DESKTOP_GRID_WITH_STOCK = "grid grid-cols-[52px_minmax(140px,1fr)_96px_104px_76px_104px_78px] items-center gap-3";
const DESKTOP_GRID_NO_STOCK = "grid grid-cols-[52px_minmax(140px,1fr)_96px_104px_76px_78px] items-center gap-3";

function BranchSelect({
  branches,
  value,
  onChange,
}: {
  branches: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
      Sucursal
      {/* Sin `name`: no viaja en el form, cambia qué sucursal se está editando.
          El form manda su propio input oculto con `branchId`. */}
      <SelectField
        ariaLabel="Sucursal"
        defaultValue={value}
        key={value}
        onChange={onChange}
        options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
      />
    </label>
  );
}

// Avatar con foto o, si no hay, la inicial del nombre sobre un tinte por
// categoría. Solo para la tabla de escritorio y el panel rápido — las cards
// de mobile siguen mostrando el ícono del rubro como ya lo hacían, no se
// tocan (ver el <ul> de mobile más abajo).
function ProductAvatar({
  product,
  size,
  textSize = "text-base",
}: {
  product: Pick<ProductRow, "id" | "imageVersion" | "catalogSlug" | "hasPhoto" | "name" | "familyName" | "categoryId">;
  size: string;
  textSize?: string;
}) {
  const imageSrc = productImageSrc(product);

  if (imageSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" className={`${size} shrink-0 rounded-2xl object-cover`} src={imageSrc} />;
  }

  const initial = (product.familyName ?? product.name).trim().charAt(0).toUpperCase() || "?";

  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-2xl font-black ${textSize} ${avatarTint(product.categoryId)}`}>
      {initial}
    </span>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const orden = active ? (dir === "asc" ? "ascendente" : "descendente") : null;

  return (
    <button
      // El nombre accesible dice el estado Y qué pasa al tocar. Con solo el
      // label, un lector de pantalla anunciaba "Costo, botón" y no había forma
      // de saber que la tabla estaba ordenada por ahí.
      aria-label={orden ? `${label}: ordenado de forma ${orden}. Tocá para invertir.` : `Ordenar por ${label}`}
      className={`group flex min-h-6 items-center gap-1 rounded-md px-1 text-xs font-black uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active ? "text-primary" : "text-slate-500 hover:text-slate-700"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
      onClick={onClick}
      type="button"
    >
      {label}
      {/* La flecha se dibuja SIEMPRE, no solo en la columna ordenada. Cuando
          aparecía únicamente en la activa, Costo/Precio/Margen se leían como
          texto plano y no había manera de saber que se podía ordenar por
          ellas salvo tocándolas de casualidad. Inactiva va tenue. */}
      <span aria-hidden="true" className={active ? "" : "opacity-40 transition group-hover:opacity-100"}>
        {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

// Filtro de selección múltiple, afuera de la tabla.
//
// Antes cada filtro vivía adentro de la cabecera de su columna, y eso traía
// dos problemas: la cabecera quedaba de dos alturas —solo las columnas con
// filtro tenían una segunda línea— y sobre todo se podía elegir UNA sola
// opción por columna. "Mostrame panes y facturas" no se podía pedir.
//
// Acá la lista vacía significa "todos": no hay una opción "Todos" que compita
// con las demás, se destildan las que haya y listo. Es lo mismo que hace el
// filtro de una planilla, que es de donde viene el modelo mental.
function MultiFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function outside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function esc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const elegidas = options.filter((option) => selected.includes(option.value));
  // Con una sola elegida se dice cuál; con varias, cuántas. Poner los nombres
  // de todas desbordaba el botón y lo hacía saltar de ancho al tildar.
  const resumen = elegidas.length === 0 ? "Todos" : elegidas.length === 1 ? elegidas[0].label : `${elegidas.length} elegidos`;
  const activo = elegidas.length > 0;

  function toggle(value: T) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          activo ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-white text-slate-600 ring-1 ring-slate-950/5 hover:bg-slate-50"
        }`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="text-slate-500">{label}</span>
        <span className={activo ? "font-black" : "font-black text-foreground"}>{resumen}</span>
        <ChevronDown className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          aria-label={label}
          aria-multiselectable="true"
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl duration-150 animate-in fade-in zoom-in-95"
          role="listbox"
        >
          {options.map((option) => {
            const tildada = selected.includes(option.value);

            return (
              <button
                aria-selected={tildada}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-base font-bold transition ${
                  tildada ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-50"
                }`}
                key={option.value}
                onClick={() => toggle(option.value)}
                role="option"
                type="button"
              >
                {/* El tilde ocupa lugar siempre, elegida o no: si apareciera
                    solo en las activas, los textos se correrían al tildar. */}
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-md border transition ${
                    tildada ? "border-primary bg-primary text-white" : "border-slate-300"
                  }`}
                >
                  {tildada ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="shrink-0 text-sm font-black tabular-nums text-slate-400">{option.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// Badge de stock con punto de color. "—" (sin badge) cuando el producto no
// lleva control de stock.
function StockBadge({ product }: { product: ProductRow }) {
  if (product.stockQuantity === null) {
    return <span className="text-base text-slate-300">—</span>;
  }

  const status = stockStatusOf(product) ?? "ok";
  const tone = STOCK_BADGE[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-black tabular-nums ${tone.badge}`}>
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {formatQuantity(product.stockQuantity, product.unit as never)}
    </span>
  );
}

// Toggle de disponibilidad que persiste solo, sin abrir la ficha completa: lo
// usan la fila de la tabla y el panel rápido. Deshabilitado sin precio: no
// hay nada que vender sin uno.
// Switch puro: sin estado ni llamada al servidor. La fila de la tabla lo usa
// envuelto en `AvailabilityQuickToggle` (guarda al toque, es un tilde suelto
// en una lista). El panel rápido lo usa directo con su propio estado local,
// para juntar el cambio con "Guardar cambios" (ver ProductQuickPanelBody) en
// vez de pegarle al servidor en cada tap.
function AvailabilityToggleSwitch({
  available,
  canToggle,
  onToggle,
}: {
  available: boolean;
  canToggle: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-checked={available}
      aria-label={canToggle ? "Disponible para vender" : "Cargá un precio para poder venderlo"}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-30 ${
        available ? "bg-emerald-500" : "bg-slate-300"
      }`}
      disabled={!canToggle}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      role="switch"
      title={canToggle ? undefined : "Cargá un precio para poder venderlo"}
      type="button"
    >
      <span
        className="absolute left-1 top-1/2 size-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: available ? "translateX(1.25rem)" : "translateX(0)" }}
      />
    </button>
  );
}

function AvailabilityQuickToggle({
  product,
  branchId,
  onChanged,
}: {
  product: ProductRow;
  branchId: string;
  onChanged: () => void;
}) {
  const [available, setAvailable] = useState(product.available);
  const [isPending, startTransition] = useTransition();
  const canToggle = product.priceValue !== null;

  function toggle() {
    if (isPending) return;
    const next = !available;
    setAvailable(next);
    startTransition(async () => {
      const result = await toggleProductAvailability({
        branchId,
        productId: product.id,
        price: product.priceValue as number,
        available: next,
      });
      if (result.ok) {
        onChanged();
      } else {
        setAvailable(!next);
        toast.error(result.error);
      }
    });
  }

  return <AvailabilityToggleSwitch available={available} canToggle={canToggle && !isPending} onToggle={toggle} />;
}

// Stepper −/valor/+ del panel rápido: puro, sin estado ni llamada al
// servidor. Cada tap solo mueve el número que ve el dueño; el commit real
// —una sola llamada a `applyProductStockAction` con `op: "adjust"`— pasa
// recién en "Guardar cambios" (ver ProductQuickPanelBody). Antes cada tap
// esperaba su propio round-trip con el botón bloqueado mientras tanto, que
// con la red lenta (o la base caída, como pasó hoy) se sentía trabado.
//
// "adjust" y no "receive"/"loss": fija la existencia al número resultante
// sin registrarlo como merma ni como mercadería recibida. Un +1/−1 genérico
// no sabe si lo que pasó fue una venta manual, una compra chica o una
// corrección de conteo — clasificarlo a ciegas ensuciaría los números de
// ganancia/merma (ver AGENTS.md, "agujeros" en la ganancia). Para lo que sí
// necesita esa distinción sigue estando `ProductStockPanel` completo, dentro
// de "Editar producto → Stock y códigos".
function StockStepperControl({
  quantity,
  unit,
  low,
  branchName,
  multiBranch,
  disabled,
  onStep,
}: {
  quantity: number;
  unit: string;
  low: boolean;
  branchName: string;
  multiBranch: boolean;
  disabled: boolean;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-950/5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black uppercase tracking-wide text-slate-500">
          Stock actual{multiBranch ? ` en ${branchName}` : ""}
        </p>
        {low ? (
          <span className="shrink-0 rounded-full bg-[#FDF0D5] px-2 py-0.5 text-xs font-black text-[#8A5A1E]">Hay que reponer</span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          aria-label="Restar una unidad"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-950/5 transition active:scale-90 disabled:opacity-40"
          disabled={disabled || quantity <= 0}
          onClick={() => onStep(-QUANTITY_SCALE)}
          type="button"
        >
          <Minus className="size-5" />
        </button>
        <span className={`min-w-[5rem] text-center text-3xl font-semibold tracking-tight tabular-nums ${low ? "text-[#8A5A1E]" : "text-foreground"}`}>
          {formatQuantity(quantity, unit as never)}
        </span>
        <button
          aria-label="Sumar una unidad"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-950/5 transition active:scale-90 disabled:opacity-40"
          disabled={disabled}
          onClick={() => onStep(QUANTITY_SCALE)}
          type="button"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  );
}

// Resumen de arriba de Productos.
//
// Reemplaza cuatro tarjetas iguales (Productos / Sin stock / Por reponer /
// Valorizado) que le daban el mismo peso a cosas que no valen lo mismo: un
// dato de contexto, DOS ALARMAS QUE NO ESTÁN SONANDO y plata. Con todo en
// orden, la mitad de la franja eran ceros gritados en cajas blancas; y como
// las cuatro pesaban igual, no se destacaba ninguna.
//
// Acá manda la plata, que es lo que el dueño viene a mirar. Los faltantes
// aparecen SOLO cuando existen, y aparecen como botón: el número dice que hay
// un problema y tocarlo filtra la lista para ir a resolverlo. Antes había que
// leer "3 por reponer" y salir a buscar cuáles eran a mano.
//
// No se toca `StatTiles` porque lo comparten otras siete pantallas: esto es
// el resumen de Productos, no un rediseño del componente común.
function CatalogSummary({
  totals,
  catalogPlural,
  onFilter,
}: {
  totals: { products: number; value: number; low: number; out: number };
  catalogPlural: string;
  onFilter: (filtro: "out" | "low") => void;
}) {
  const alertas = [
    { key: "out" as const, cantidad: totals.out, label: "sin stock", clases: "bg-rose-50 text-rose-700 hover:bg-rose-100" },
    { key: "low" as const, cantidad: totals.low, label: "por reponer", clases: "bg-[#FDF0D5] text-[#8A5A1E] hover:bg-[#F8E3B8]" },
  ].filter((alerta) => alerta.cantidad > 0);

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-3xl bg-white px-5 py-4 ring-1 ring-slate-950/5">
      <div className="min-w-0">
        <p className="text-sm font-black uppercase tracking-wide text-slate-500">Valorizado</p>
        <p className="mt-0.5 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          <AnimatedMoney value={totals.value} />
        </p>
        <p className="mt-0.5 text-sm text-slate-500">
          A precio de costo · {totals.products} {catalogPlural.toLowerCase()}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {alertas.length === 0 ? (
          // Que no falte nada es una respuesta, no un vacío: se dice una vez y
          // en voz baja, en vez de dos tarjetas con un cero cada una.
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-700">
            <Check className="size-4" />
            Todo con stock
          </span>
        ) : (
          alertas.map((alerta) => (
            <button
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-black transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${alerta.clases}`}
              key={alerta.key}
              onClick={() => onFilter(alerta.key)}
              type="button"
            >
              <span className="text-lg tabular-nums">{alerta.cantidad}</span>
              {alerta.label}
              <ArrowRight className="size-4 opacity-60" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// El panel del producto, UNO SOLO para las tres superficies: el panel fijo de
// xl, el flotante de lg y el sheet de mobile. Lo único que cambia es el alto
// de la foto y si hay botón de cerrar; el contenido es literalmente el mismo
// componente. Antes había dos implementaciones distintas del mismo panel
// (una compacta con avatar y otra con foto grande) y cada arreglo había que
// hacerlo dos veces.
//
// La foto va arriba y FUERA del <form>: es lo único que se guarda solo, sin
// esperar a "Guardar cambios" (ver ProductPhotoField). Y es la única foto de
// la pantalla — se toca ahí para cambiarla, no hay un campo "Foto" más abajo
// repitiendo la misma imagen.
function ProductPanel({
  product,
  data,
  variant,
  onClose,
}: {
  product: ProductRow;
  data: ProductsData;
  variant: "sheet" | "panel";
  onClose?: () => void;
}) {
  const esSheet = variant === "sheet";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0">
        <ProductPhotoField
          aiEnabled={data.aiImagesEnabled}
          catalogSlug={product.catalogSlug}
          // Sin redondeo propio: el contenedor (sheet o drawer) ya recorta con
          // `overflow-hidden`. Cuando la foto traía SU radio adentro de un panel
          // que ya redondeaba, las dos curvas no coincidían y quedaban cuñas
          // blancas en las esquinas de arriba.
          className={esSheet ? "h-[38vh] max-h-80 min-h-56" : "h-44"}
          fallback={
            <div className={`flex size-full items-center justify-center ${avatarTint(product.categoryId)}`}>
              <DynamicIcon className="size-16 opacity-70" name={data.catalogIcon} />
            </div>
          }
          hasPhoto={product.hasPhoto}
          productDescription={product.description}
          productId={product.id}
          productName={product.name}
          version={product.imageVersion}
        />
        {onClose ? (
          <button
            aria-label="Cerrar"
            className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/85 text-foreground shadow-sm backdrop-blur-sm transition active:scale-90"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>

      {/* En las dos superficies la foto queda fija arriba y el contenido
          scrollea adentro: el panel de escritorio ahora es un drawer de alto
          completo, así que si el contenido fluyera se cortaría abajo sin forma
          de llegar a "Guardar cambios". */}
      <div className={`min-h-0 flex-1 overflow-y-auto px-5 pb-6 ${esSheet ? "pt-5" : "pt-4"}`}>
        <ProductQuickPanelBody data={data} product={product} />
      </div>
    </div>
  );
}

// Todo lo del producto vive acá, repartido en tres pestañas: Datos (qué es y
// a cuánto se vende), Stock (cuánto hay y qué le pasó) y Análisis (cómo
// viene). Se usa tal cual debajo de la foto, con el mismo contenido en las
// tres superficies — lo que cambia afuera es el contenedor, nunca cómo se
// opera sobre el producto. Es la ÚNICA superficie de edición: no hay un
// segundo modal "Editar producto" al que saltar.
//
// Disponibilidad, precio, costo, datos y el stepper de stock se editan
// LOCAL: nada pega al servidor hasta que se toca "Guardar cambios", que
// manda todo lo que haya cambiado en una sola tanda. Antes cada tap del
// toggle o del stepper esperaba su propio round-trip con el control
// bloqueado mientras tanto — bloqueaba al que estaba tocando, y con la base
// caída (como pasó una vez) un tap podía quedar colgado varios segundos. Los
// movimientos con motivo (recibir/contar/perder, abajo de "¿Qué pasó?") son
// la excepción a propósito: son hechos puntuales con su propio motivo, no
// algo que se tipee de a poco, así que guardan solos como ya hacían.
//
// Precio, costo y los campos de datos no tienen onChange controlado
// —`MoneyInput` guarda su propio valor y no lo expone— así que viven en un
// <form> propio: se leen con FormData al tipear (para el margen en vivo y
// para saber si hay algo sin guardar) y de nuevo al guardar. No es el
// <form action=…> de un submit real: `onSubmit` corta el envío nativo, esto
// es solo el contenedor que permite `new FormData(...)`. Los campos de
// "Detalles" quedan montados aunque esa pestaña no esté a la vista —ocultos
// con CSS, no desmontados— porque un campo desmontado no viaja en el
// FormData: cambiar de pestaña borraría en silencio lo que se escribió del
// otro lado.
function ProductQuickPanelBody({ product, data }: { product: ProductRow; data: ProductsData }) {
  const router = useRouter();
  const hasStock = data.features.stock && product.stockQuantity !== null;
  const formRef = useRef<HTMLFormElement>(null);

  // Hay hasta tres paneles montados a la vez (el fijo de xl, el flotante de lg
  // y el sheet de mobile), así que los id de las pestañas tienen que ser
  // únicos por instancia o `aria-controls` apuntaría al panel de otro.
  const panelId = useId();
  const [activeTab, setActiveTab] = useState<"datos" | "stock" | "analisis">("datos");
  const [pendingAvailable, setPendingAvailable] = useState(product.available);
  const [pendingQuantity, setPendingQuantity] = useState(product.stockQuantity ?? 0);
  const [livePrice, setLivePrice] = useState(product.priceValue);
  const [liveCost, setLiveCost] = useState(product.cost);
  const [liveDetails, setLiveDetails] = useState(() => detailsSnapshotOf(product));
  const [isSaving, startSaving] = useTransition();

  function syncFromForm() {
    const formEl = formRef.current;
    if (!formEl) return;
    const formData = new FormData(formEl);
    const priceRaw = formData.get("price");
    const costRaw = formData.get("cost");
    setLivePrice(typeof priceRaw === "string" ? parseAmountInput(priceRaw) : product.priceValue);
    setLiveCost(typeof costRaw === "string" ? parseAmountInput(costRaw) : product.cost);
    setLiveDetails(readDetailsSnapshot(formData));
  }

  // Los desplegables (`SelectField`) no disparan `change`: guardan el valor en
  // un input oculto que React actualiza por su cuenta, y asignar `value` por
  // código no emite ningún evento. Como el `onChange` del <form> es lo que
  // detecta que hay algo sin guardar, cambiar categoría, tipo o unidad NO
  // hacía aparecer "Guardar cambios" — el cambio se perdía en silencio al
  // cerrar el panel. Por eso el valor nuevo se anota acá a mano.
  //
  // No sirve releer el FormData desde este callback: `SelectField` avisa justo
  // después de su `setState`, cuando el input oculto todavía tiene el valor
  // viejo en el DOM.
  function setDetail(field: keyof ProductDetailsSnapshot, value: string) {
    setLiveDetails((current) => ({ ...current, [field]: value }));
  }

  const margin = margenPct(liveCost, livePrice);
  const canToggle = livePrice !== null;
  const priceDirty = livePrice !== product.priceValue;
  const costDirty = liveCost !== product.cost;
  const availabilityDirty = pendingAvailable !== product.available;
  const stockDirty = hasStock && pendingQuantity !== product.stockQuantity;
  const detailsDirty = JSON.stringify(liveDetails) !== JSON.stringify(detailsSnapshotOf(product));
  // Costo viaja junto con el resto de la ficha (updateProductDetails), no con
  // el precio: es un dato del producto, no de la sucursal.
  const fieldsDirty = costDirty || detailsDirty;
  const dirty = availabilityDirty || stockDirty || priceDirty || fieldsDirty;
  const low = product.minStockRaw !== null && pendingQuantity <= product.minStockRaw;

  // Ninguna se llama "Ficha": la ficha del producto es el panel entero, así que
  // usar esa palabra para una solapa de adentro decía que las otras dos no son
  // parte de la ficha. Las tres responden preguntas distintas sobre el mismo
  // producto: qué es y a cuánto se vende, cuánto hay, y cómo viene.
  //
  // La de stock se muestra según `hasStock` y no según el módulo: un servicio
  // no tiene existencias, así que con el módulo prendido igual abría una
  // pestaña que no dibujaba nada (`ProductStockPanel` devuelve null sin
  // cantidad, y el stepper tampoco se renderiza).
  const tabs = [
    { key: "datos" as const, label: "Datos" },
    ...(hasStock ? [{ key: "stock" as const, label: "Stock" }] : []),
    { key: "analisis" as const, label: "Análisis" },
  ];

  // Tipo, unidad y bulto son las tres preguntas sobre LA CANTIDAD: si se
  // cuenta o no, en qué se cuenta, y de a cuántos viene. Van con el stock, no
  // con el precio.
  //
  // Se arma una sola vez y se ubica según el caso, porque si viviera fijo en
  // la pestaña de stock un servicio se quedaría sin "Tipo" —esa pestaña no
  // existe sin existencias— y no habría forma de convertirlo en producto
  // físico nunca más. Sin stock, entonces, baja a "Datos".
  //
  // UNA columna, no dos. En un panel de ~344px, dos columnas dejaban cada
  // campo en ~166px: el tipo se veía "Producto fís…" cortado y los labels
  // largos se partían en dos renglones, así que las columnas quedaban
  // desalineadas entre sí. Los labels se acortaron para entrar en un renglón
  // —lo que necesita explicación la tiene abajo, en minúscula— porque una
  // frase larga en mayúsculas es justo lo que peor se lee.
  const comoSeVende = (
    <div className="grid gap-4 border-t border-slate-100 pt-4">
      <p className={sectionLabel}>Cómo se vende</p>

      <label className="grid gap-1.5">
        <span className={fieldLabel}>Tipo</span>
        {/* De acá sale si lleva stock: un servicio no tiene existencias y un
            producto físico sí. Antes había además un tilde "Controlar stock"
            que decía lo mismo y permitía guardar la contradicción. La
            consecuencia salió de la opción y bajó al texto de ayuda: adentro
            del desplegable no se llegaba a leer. */}
        <SelectField
          ariaLabel="Tipo"
          defaultValue={product.kind}
          name="kind"
          onChange={(value) => setDetail("kind", value)}
          options={[
            { value: "GOOD", label: "Producto físico" },
            { value: "SERVICE", label: "Servicio" },
          ]}
        />
        <span className={fieldHint}>Un servicio no lleva stock: no se cuenta ni se descuenta al vender.</span>
      </label>

      <label className="grid gap-1.5">
        <span className={fieldLabel}>Se vende por</span>
        <SelectField
          ariaLabel="Se vende por"
          defaultValue={product.unit}
          name="unit"
          onChange={(value) => setDetail("unit", value)}
          options={data.units.map((unit) => ({ value: unit.value, label: unit.label }))}
        />
      </label>

      {/* Los dos campos del bulto son UNA cosa —"una caja de 24"— así que van
          en una fila con un solo título. Separados, el segundo quedaba solo al
          final con un hueco al lado. */}
      {data.features.packs ? (
        <div className="grid gap-1.5">
          <span className={fieldLabel}>Bulto</span>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <input
              aria-label="Unidades por bulto"
              className={`${sheetInput} tabular-nums`}
              defaultValue={product.packSize ?? ""}
              inputMode="numeric"
              name="packSize"
              placeholder="24"
            />
            <input
              aria-label="Cómo se llama el bulto"
              className={sheetInput}
              defaultValue={product.packLabel ?? ""}
              name="packLabel"
              placeholder="Caja"
            />
          </div>
          <span className={fieldHint}>Cuántas unidades trae y cómo le decís.</span>
        </div>
      ) : (
        <>
          <input name="packSize" type="hidden" value={product.packSize ?? ""} />
          <input name="packLabel" type="hidden" value={product.packLabel ?? ""} />
        </>
      )}
    </div>
  );

  function save() {
    // Un precio inválido bloquea TODO el guardado, no solo el precio: si
    // dejara pasar el resto, "Guardar cambios" parecería andar bien y el
    // precio se quedaría viejo sin ningún aviso.
    if (priceDirty && livePrice === null) {
      toast.error("Poné un precio válido para poder venderlo.");
      return;
    }

    if (fieldsDirty && liveDetails.name.trim().length === 0) {
      toast.error("Completá el nombre del ítem.");
      return;
    }

    startSaving(async () => {
      const detailsFormData = fieldsDirty && formRef.current ? new FormData(formRef.current) : null;

      const [priceResult, detailsResult, stockResult] = await Promise.all([
        priceDirty || availabilityDirty
          ? toggleProductAvailability({
              branchId: data.selectedBranchId,
              productId: product.id,
              price: livePrice as number,
              available: pendingAvailable,
            })
          : null,
        detailsFormData ? updateProductDetails(detailsFormData) : null,
        stockDirty
          ? applyProductStockAction({ op: "adjust", productId: product.id, branchId: data.selectedBranchId, quantity: pendingQuantity })
          : null,
      ]);

      const failed = [priceResult, detailsResult, stockResult].find((result) => result && !result.ok);
      if (failed && !failed.ok) {
        toast.error(failed.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form className="flex flex-col gap-5" onChange={syncFromForm} onSubmit={(event) => event.preventDefault()} ref={formRef}>
        <input name="productId" type="hidden" value={product.id} />
        <input name="hasCommercialFields" type="hidden" value="true" />

        {/* Identidad. Categoría, nombre y descripción se editan ACÁ, que es
            donde se leen. Antes esto eran un título y dos badges de solo
            lectura, y los campos para cambiarlos estaban repetidos en la
            pestaña de abajo: tipear el nombre nuevo no cambiaba el título, así
            que la misma pantalla mostraba dos valores distintos del mismo dato. */}
        <div className="flex flex-col gap-1">
          <div className="w-44">
            <SelectField
              ariaLabel="Categoría"
              defaultValue={product.categoryId ?? ""}
              name="categoryId"
              onChange={(value) => setDetail("categoryId", value)}
              options={[
                { value: "", label: "Sin categoría" },
                ...data.categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
              size="sm"
            />
          </div>
          <input aria-label="Nombre" className={identityTitleInput} defaultValue={product.name} name="name" required type="text" />
          <input
            aria-label="Descripción"
            className={identityNoteInput}
            defaultValue={product.description ?? ""}
            name="description"
            placeholder="Agregá una descripción (opcional)"
            type="text"
          />
        </div>

        {/* Las pestañas van ACÁ, apenas debajo de la identidad, y parten TODO
            lo que sigue. Antes estaban en el medio, con precio y stock arriba
            y una pestaña "Ficha" abajo: la ficha del producto es todo el
            panel, así que no puede ser una solapa dentro de sí misma. Lo único
            que queda fuera de las pestañas es qué producto es —foto, nombre,
            categoría, descripción—, que tiene que seguir a la vista aunque
            estés mirando los movimientos. */}
        <div aria-label="Secciones del producto" className="flex gap-1 rounded-full bg-slate-100 p-1" role="tablist">
          {tabs.map((tab, index) => {
            const activa = activeTab === tab.key;

            return (
              <button
                aria-controls={`${panelId}-panel-${tab.key}`}
                aria-selected={activa}
                className={`min-h-11 flex-1 rounded-full px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  activa ? "bg-white text-foreground shadow-sm" : "text-slate-600"
                }`}
                id={`${panelId}-tab-${tab.key}`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(event) => {
                  // Flechas para moverse entre pestañas, que es como se espera
                  // que funcione un tablist con el teclado.
                  const paso = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                  if (paso === 0) return;
                  event.preventDefault();
                  const siguiente = tabs[(index + paso + tabs.length) % tabs.length];
                  setActiveTab(siguiente.key);
                  document.getElementById(`${panelId}-tab-${siguiente.key}`)?.focus();
                }}
                role="tab"
                // Roving tabindex: el tablist entero es UNA parada de tabulador,
                // no tres.
                tabIndex={activa ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          aria-labelledby={`${panelId}-tab-datos`}
          className={activeTab === "datos" ? "flex flex-col gap-5" : "hidden"}
          id={`${panelId}-panel-datos`}
          role="tabpanel"
        >
        {/* El badge "Disponible" de antes decía exactamente lo mismo que este
            toggle. Quedó el control, que además explica por qué no se puede
            prender cuando falta el precio — antes eso era un `title`, que en
            el celular no se ve nunca. */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3.5">
          <div className="min-w-0">
            <span className="text-base font-black text-foreground">Disponible para vender</span>
            {!canToggle ? <p className="mt-0.5 text-sm text-slate-500">Cargá un precio para poder venderlo.</p> : null}
          </div>
          <AvailabilityToggleSwitch available={pendingAvailable} canToggle={canToggle} onToggle={() => setPendingAvailable((value) => !value)} />
        </div>

        {/* Mismo tratamiento de "tarjeta" que Disponible y Stock actual: las tres
            son cosas que se tocan acá, así que se ven como el mismo tipo de
            cosa. Precio y costo eran texto suelto con un input incrustado —
            nada avisaba que se podían tocar, y costo encima quedaba con
            jerarquía de dato secundario aunque es tan editable como el precio. */}
        <div className="grid grid-cols-2 gap-3">
          <label className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-950/5 transition focus-within:ring-2 focus-within:ring-primary">
            <span className="block text-sm font-black uppercase tracking-wide text-slate-500">Precio</span>
            <span className="mt-0.5 flex items-baseline gap-1">
              <span className="shrink-0 text-lg font-semibold text-slate-400">$</span>
              <MoneyInput
                className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground tabular-nums outline-none"
                defaultValue={product.priceValue}
                name="price"
                placeholder="0"
              />
            </span>
          </label>
          <label className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-950/5 transition focus-within:ring-2 focus-within:ring-primary">
            <span className="block text-sm font-black uppercase tracking-wide text-slate-500">Costo</span>
            <span className="mt-0.5 flex items-baseline gap-1">
              <span className="shrink-0 text-lg font-semibold text-slate-400">$</span>
              <MoneyInput
                className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground tabular-nums outline-none"
                defaultValue={product.cost}
                name="cost"
                placeholder="—"
              />
            </span>
          </label>
        </div>

        {/* El margen no se edita —sale de precio y costo— así que se ve como
            badge, no como tercer campo: la forma ya avisa que es un resultado,
            no algo que se toca. */}
        {margin !== null ? (
          <div className="-mt-2 flex justify-center">
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                margin < 30 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              Margen · {margin}%
            </span>
          </div>
        ) : null}

        {/* Pegado al precio y no adentro de una pestaña: el descuento es la
            razón por la que el precio de arriba no es el que se va a cobrar.
            Sin esto se termina bajando el precio a mano sobre una promo que ya
            está descontando. Se avisa, no se edita: las promos se arman en su
            pantalla, donde se elige vigencia, mínimos y a qué alcanza. */}
        {product.promociones.length > 0 ? (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Tiene descuento activo</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {product.promociones.map((promocion) => (
                <span
                  className="rounded-full bg-white px-2.5 py-1 text-sm font-black text-emerald-700 ring-1 ring-emerald-200"
                  key={promocion.id}
                  title={promocion.name}
                >
                  {promocion.label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-emerald-800/80">
              Se aplica solo al cobrar, sobre este precio.{" "}
              <Link className="font-black underline" href="/promotions">
                Ver promociones
              </Link>
            </p>
          </div>
        ) : null}


          {/* Lo que se configura una vez, al final y separado: no compite con
              lo que se mira todos los días. */}
          <div className="grid gap-4 border-t border-slate-100 pt-4">
            <p className={sectionLabel}>Cómo se identifica</p>

            {data.features.barcodes ? (
              <label className="grid gap-1.5">
                <span className={fieldLabel}>Código de barras</span>
                <input className={sheetInput} defaultValue={product.barcode ?? ""} name="barcode" placeholder="7790000000000" />
                <span className={fieldHint}>El que trae impreso el producto. Se puede escanear al vender.</span>
              </label>
            ) : (
              <input name="barcode" type="hidden" value={product.barcode ?? ""} />
            )}

            <label className="grid gap-1.5">
              <span className={fieldLabel}>Código interno</span>
              <input className={sheetInput} defaultValue={product.sku ?? ""} name="sku" placeholder="REM-NEG-M" />
              {/* "SKU" es jerga: el dueño que abre esto por primera vez no
                  tiene por qué saber qué es. El campo sigue llamándose `sku`
                  en la base; lo que cambia es cómo se lo nombra en pantalla. */}
              <span className={fieldHint}>Opcional. El código con el que vos lo identificás.</span>
            </label>
          </div>

          {/* Sin existencias no hay pestaña de stock, así que "Cómo se vende"
              baja acá: si no, "Tipo" quedaría fuera de alcance y un servicio no
              se podría convertir nunca en producto físico. */}
          {hasStock ? null : comoSeVende}
        </div>

        {hasStock ? (
          <div
            aria-labelledby={`${panelId}-tab-stock`}
            className={activeTab === "stock" ? "flex flex-col gap-4" : "hidden"}
            id={`${panelId}-panel-stock`}
            role="tabpanel"
          >
            <StockStepperControl
              branchName={data.selectedBranchName}
              disabled={isSaving}
              low={low}
              multiBranch={data.branches.length > 1}
              onStep={(delta) => setPendingQuantity((value) => Math.max(0, value + delta))}
              quantity={pendingQuantity}
              unit={product.unit}
            />
            <p className={`${fieldHint} -mt-2`}>Para corregir de a poco. Se guarda junto con el resto de los cambios.</p>

            {/* El mínimo es una regla del stock, así que vive con el stock y no
                entre los códigos y los bultos. Además ahí el label tenía que
                decir "Avisar cuando queden menos de" para explicarse solo, y en
                mayúsculas se partía en dos renglones; al lado de la existencia
                alcanza con una palabra. */}
            <label className="grid gap-1.5">
              <span className={fieldLabel}>Mínimo</span>
              <input
                className={`${sheetInput} tabular-nums`}
                defaultValue={product.minStockValue}
                inputMode="decimal"
                name="minStock"
                placeholder="Ej: 5"
              />
              <span className={fieldHint}>Te avisamos cuando queden menos de esta cantidad.</span>
            </label>

            {/* Las dos formas de tocar la existencia quedaron juntas, así que
                hay que decir en qué se diferencian sin obligar a aprenderlo: el
                stepper corrige el número, esto cuenta lo que pasó. La pregunta
                de arriba enmarca los tres botones, que ya están escritos como
                hechos del negocio ("Llegó mercadería"), no como operaciones.

                `showSummary={false}` porque el stepper está a la vista acá
                nomás: repetir "Quedan 19" abajo del 19 que se acaba de leer
                hace parecer que son dos números distintos. */}
            <div className="grid gap-2 border-t border-slate-100 pt-4">
              <p className={sectionLabel}>¿Qué pasó?</p>
              <p className={`${fieldHint} -mt-1`}>Queda anotado en el historial con su motivo y se guarda al momento.</p>
              {/* Al aplicar un movimiento el stepper se pone en la cantidad que
                  quedó: si no, seguía mostrando la de antes y "Guardar cambios"
                  la habría vuelto a fijar, pisando el movimiento recién hecho. */}
              <ProductStockPanel
                branchId={data.selectedBranchId}
                branchName={data.selectedBranchName}
                minStock={product.minStockRaw}
                onChanged={(quantity) => {
                  setPendingQuantity(quantity);
                  router.refresh();
                }}
                productId={product.id}
                quantity={product.stockQuantity}
                showSummary={false}
                unit={product.unit as never}
              />
            </div>

            {comoSeVende}
          </div>
        ) : (
          // Sin existencias el mínimo no significa nada, pero igual tiene que
          // VIAJAR: `updateProductDetails` arma el producto con lo que llega en
          // el FormData, así que un campo que no se renderiza se guardaría como
          // vacío y borraría el mínimo que ya estaba puesto.
          <input name="minStock" type="hidden" value={product.minStockValue} />
        )}
      </form>

      {/* El panel existe siempre aunque esté vacío: su `id` es el destino del
          `aria-controls` de la pestaña, y apuntar a un elemento que no está en
          el DOM deja la pestaña sin decir qué controla. Lo que se monta recién
          al abrirla es el CONTENIDO —no tiene campos del <form>, así que no se
          pierde nada— y con eso se sigue disparando la consulta solo cuando se
          mira. */}
      <div
        aria-labelledby={`${panelId}-tab-analisis`}
        className={activeTab === "analisis" ? "" : "hidden"}
        id={`${panelId}-panel-analisis`}
        role="tabpanel"
      >
        {activeTab === "analisis" ? (
          <ProductAnalyticsTab activa productId={product.id} unidad={product.unit as never} usaStock={data.features.stock} />
        ) : null}
      </div>

      {/* Barra de guardado pegada al piso del panel. Antes era un botón más al
          final del contenido: con la ficha entera adentro se iba abajo del
          scroll, así que cambiabas el precio arriba y no veías con qué
          confirmarlo. Aparece solo cuando hay algo sin guardar, así que
          también hace de aviso de que quedó algo pendiente.

          Los márgenes negativos la sacan del padding del contenedor para que
          el fondo blanco llegue de borde a borde: si no, el contenido que pasa
          por debajo se ve asomando por los costados.

          `-bottom-6` y no `bottom-0`: el desplazamiento de un sticky se mide
          contra el borde INTERIOR del contenedor, así que con 0 la barra
          frenaba 24px más arriba —el `pb-6` del scroll— y dejaba una franja
          blanca abajo. El margen negativo no alcanza para eso: no corrige
          dónde se pega, solo dónde termina el contenido.

          Sin botón de eliminar: no existe `deleteProduct` en este codebase y
          "Anular revierte, no borra" es invariante del proyecto (ver
          AGENTS.md) — no se inventa esa capacidad acá. */}
      {dirty ? (
        <div className="sticky -bottom-6 -mx-5 -mb-6 mt-auto border-t border-slate-100 bg-white px-5 pb-5 pt-4">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-base font-black text-white transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
            disabled={isSaving}
            onClick={save}
            type="button"
          >
            {isSaving ? <Loader2 className="size-5 animate-spin" /> : null}
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TransferForm({ data }: { data: ProductsData }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-950/5">
      <p className="text-base font-black text-foreground">Traspaso entre sucursales</p>
      <p className="mt-0.5 text-sm text-slate-500">Sale de {data.selectedBranchName} y entra en la otra, en un solo acto.</p>
      <RefreshActionForm action={transferStockAction} className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess>
        <input name="branchId" type="hidden" value={data.selectedBranchId} />
        <label className="grid gap-1.5 text-sm font-black uppercase tracking-wide text-slate-500 sm:col-span-2">
          Producto
          <SelectField ariaLabel="Producto" name="productId" options={data.products.map((product) => ({ value: product.id, label: product.name }))} />
        </label>
        <label className="grid gap-1.5 text-sm font-black uppercase tracking-wide text-slate-500">
          Hacia
          <SelectField
            ariaLabel="Sucursal destino"
            name="toBranchId"
            options={data.branches.filter((branch) => branch.id !== data.selectedBranchId).map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-black uppercase tracking-wide text-slate-500">
          Cantidad
          <input className={`${sheetInput} tabular-nums`} inputMode="decimal" name="quantity" placeholder="0" required />
        </label>
        <button
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-base font-black text-white transition hover:bg-primary-strong active:scale-[0.99] sm:col-span-2"
          type="submit"
        >
          <ArrowLeftRight className="size-4" />
          Traspasar
        </button>
      </RefreshActionForm>
    </div>
  );
}

// Historial de movimientos + traspaso entre sucursales: lo que antes vivía en
// /stock. El markup de la tabla recrea `MovimientosLista` de
// stock-manager.tsx (esa pantalla queda huérfana a propósito, no se importa
// nada de ahí).
function MovementsSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: ProductsData }) {
  return (
    <BottomSheet onClose={onClose} open={open} panelClassName={sheetVars} size="dialog">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">Movimientos</h3>
          <button
            aria-label="Cerrar"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6">
          {data.stockMovements.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-base text-slate-500">
              Todavía no hay movimientos en {data.selectedBranchName}.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-950/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="px-3 py-2.5 text-sm font-black uppercase tracking-wide text-slate-500" scope="col">
                      Cuándo
                    </th>
                    <th className="px-3 py-2.5 text-sm font-black uppercase tracking-wide text-slate-500" scope="col">
                      Producto
                    </th>
                    <th className="px-3 py-2.5 text-sm font-black uppercase tracking-wide text-slate-500" scope="col">
                      Qué pasó
                    </th>
                    <th className="px-3 py-2.5 text-right text-sm font-black uppercase tracking-wide text-slate-500" scope="col">
                      Movimiento
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.stockMovements.map((movement) => (
                    <tr className="border-b border-slate-50 last:border-0" key={movement.id}>
                      <td className="whitespace-nowrap px-3 py-2.5 text-base font-semibold text-slate-500">{movement.when}</td>
                      <td className="max-w-0 truncate px-3 py-2.5 text-base font-bold text-foreground">{movement.productName}</td>
                      <td className="px-3 py-2.5 text-base text-slate-500">
                        {movement.typeLabel}
                        {movement.reason ? ` · ${movement.reason}` : ""}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2.5 text-right text-base font-black tabular-nums ${
                          movement.quantity >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {movement.quantity >= 0 ? "+" : "−"}
                        {formatQuantity(Math.abs(movement.quantity), movement.unit as never)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Solo con más de una sucursal: traspasar hacia donde no hay a
              dónde no tiene sentido. */}
          {data.branches.length > 1 ? <TransferForm data={data} /> : null}
        </div>
      </div>
    </BottomSheet>
  );
}

export function ProductsManager({ data }: { data: ProductsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreating, startCreating] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<{
    id: string;
    name: string;
    description: string | null;
  } | null>(null);
  // Alta paso a paso. Los campos de todos los pasos quedan montados dentro de un
  // mismo <form> y sólo se muestra el del paso actual: así los valores se
  // conservan al ir y volver sin duplicar estado, y `MoneyInput` —que maneja su
  // propio formato y no admite `value`— sigue funcionando tal cual.
  //
  // El form NO tiene `action` y bloquea su propio submit: el alta se dispara
  // sólo desde el botón del último paso, leyendo los campos por este ref. Con
  // `action` puesto, "Seguir" creaba el producto en el anteúltimo paso: React
  // reutiliza el mismo nodo de botón para "Seguir" y "Crear" —están en la misma
  // posición del árbol— y le cambia el `type` durante el re-render síncrono del
  // click, así que el navegador terminaba ejecutando el submit sobre el botón ya
  // convertido. También cierra la puerta al Enter dentro de un campo.
  const newFormRef = useRef<HTMLFormElement>(null);
  const [newStep, setNewStep] = useState(0);
  // Del nombre sí guardamos copia: es lo único obligatorio y hay que saber si se
  // puede avanzar antes de que el form se mande.
  const [nuevoNombre, setNuevoNombre] = useState("");
  // La foto viaja ya redimensionada (mismo helper que la ficha) y se sube recién
  // cuando el producto existe: `saveProductImage` lo busca en la base y sin id
  // no hay dónde guardarla.
  const [foto, setFoto] = useState<{ file: File; preview: string } | null>(null);
  // El catálogo es la puerta de entrada a cambiar un precio y a corregir stock.
  // Con 60 productos, sin buscador es scroll puro — y el mostrador ya tenía uno.
  const [search, setSearch] = useState("");
  const [newBranchId, setNewBranchId] = useState(data.selectedBranchId);
  const newBranchName = data.branches.find((branch) => branch.id === newBranchId)?.name ?? "";

  // ── Panel rápido (Productos+Stock unificados) ──────────────────────────
  // Selección separada por breakpoint a propósito: BottomSheet portalea a
  // document.body, así que ocultar SU instancia con CSS (un wrapper
  // `lg:hidden`) no alcanza — el portal se escapa de cualquier contenedor, y
  // terminaría abriéndose también en escritorio. Con dos estados
  // independientes ni hace falta esa pelea: la fila de escritorio solo es
  // clickeable cuando esa tabla está visible, y lo mismo para la card de
  // mobile, así que cada uno se llena solo desde donde corresponde.
  const [desktopSelectedId, setDesktopSelectedId] = useState<string | null>(null);
  const [mobileSheetId, setMobileSheetId] = useState<string | null>(null);
  const [movementsOpen, setMovementsOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Listas, no un valor: se puede pedir "panes Y facturas". Vacía = todos.
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [stockFilter, setStockFilter] = useState<StockFilterValue[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilterValue[]>([]);
  // Mobile: un solo filtro activo a la vez (ver spec), por eso es un único
  // string en vez de las tres variables independientes de escritorio.
  const [mobileFilter, setMobileFilter] = useState("all");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function selectDesktopProduct(id: string) {
    setDesktopSelectedId(id);
  }

  function closeDesktopPanel() {
    setDesktopSelectedId(null);
  }

  function closeMobilePanel() {
    setMobileSheetId(null);
  }

  const desktopSelectedProduct = data.products.find((product) => product.id === desktopSelectedId) ?? null;
  const mobileSelectedProduct = data.products.find((product) => product.id === mobileSheetId) ?? null;

  // Sin acentos y sin distinguir mayúsculas: "coca" tiene que encontrar
  // "Coca-Cola" y "banana" tiene que encontrar "Banana".
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of data.categories) map.set(category.id, category.name);
    return map;
  }, [data.categories]);

  // El buscador de escritorio promete "por nombre, categoría o código": usar
  // el mismo predicado acá y en mobile evita mantener dos formas de "esto
  // matchea" que con el tiempo terminan divergiendo.
  function matchesSearch(product: ProductRow, normalizedQuery: string): boolean {
    if (!normalizedQuery) return true;
    const categoryName = product.categoryId ? categoryNameById.get(product.categoryId) ?? "" : "";
    return [product.name, product.familyName ?? "", product.sku ?? "", product.barcode ?? "", categoryName].some((field) =>
      normalize(field).includes(normalizedQuery),
    );
  }

  const query = normalize(search.trim());
  const hasInsumos = useMemo(() => data.products.some((product) => product.kind === "INGREDIENT"), [data.products]);

  // ── Mobile: chips de un solo filtro combinado ──────────────────────────
  const mobileChips = useMemo(() => {
    const chips: { value: string; label: string; count: number; alert?: boolean }[] = [
      { value: "all", label: "Todos", count: data.products.length },
      ...data.categories.map((category) => ({
        value: `${MOBILE_CATEGORY_PREFIX}${category.id}`,
        label: category.name,
        count: data.products.filter((product) => product.categoryId === category.id).length,
      })),
    ];

    if (data.features.stock) {
      chips.push({
        value: "out",
        label: "Sin stock",
        count: data.products.filter((product) => stockStatusOf(product) === "out").length,
        alert: true,
      });
      chips.push({
        value: "low",
        label: "Stock bajo",
        count: data.products.filter((product) => stockStatusOf(product) === "low").length,
        alert: true,
      });
      if (hasInsumos) {
        chips.push({ value: "insumos", label: "Insumos", count: data.products.filter((product) => product.kind === "INGREDIENT").length });
      }
    }

    chips.push({ value: "paused", label: "Pausados", count: data.products.filter((product) => !product.available).length });
    return chips;
  }, [data.products, data.categories, data.features.stock, hasInsumos]);

  function matchesMobileFilter(product: ProductRow): boolean {
    if (mobileFilter === "all") return true;
    if (mobileFilter === "out") return stockStatusOf(product) === "out";
    if (mobileFilter === "low") return stockStatusOf(product) === "low";
    if (mobileFilter === "paused") return !product.available;
    if (mobileFilter === "insumos") return product.kind === "INGREDIENT";
    if (mobileFilter.startsWith(MOBILE_CATEGORY_PREFIX)) return product.categoryId === mobileFilter.slice(MOBILE_CATEGORY_PREFIX.length);
    return true;
  }

  const mobileVisibleProducts = data.products.filter((product) => matchesMobileFilter(product) && matchesSearch(product, query));

  // ── Escritorio: tres filtros independientes (AND) + orden ──────────────
  // Sin opción "Todos": en un multiselect sería una opción que contradice a
  // las otras (¿qué significa "Todos" + "Panes" tildados?). No elegir nada ya
  // quiere decir todos.
  const categoryFilterOptions = useMemo(() => {
    const options: FilterOption<string>[] = data.categories.map((category) => ({
      value: category.id,
      label: category.name,
      count: data.products.filter((product) => product.categoryId === category.id).length,
    }));
    if (hasInsumos) {
      options.push({ value: CATEGORY_INSUMOS, label: "Insumos", count: data.products.filter((product) => product.kind === "INGREDIENT").length });
    }
    return options;
  }, [data.products, data.categories, hasInsumos]);

  const stockFilterOptions = useMemo<FilterOption<StockFilterValue>[]>(
    () => [
      { value: "in", label: "Con stock", count: data.products.filter((product) => stockStatusOf(product) === "ok").length },
      { value: "low", label: "Stock bajo", count: data.products.filter((product) => stockStatusOf(product) === "low").length },
      { value: "out", label: "Sin stock", count: data.products.filter((product) => stockStatusOf(product) === "out").length },
    ],
    [data.products],
  );

  const availabilityFilterOptions = useMemo<FilterOption<AvailabilityFilterValue>[]>(
    () => [
      { value: "available", label: "A la venta", count: data.products.filter((product) => product.available).length },
      { value: "paused", label: "Pausados", count: data.products.filter((product) => !product.available).length },
    ],
    [data.products],
  );

  const hayFiltros = categoryFilter.length > 0 || stockFilter.length > 0 || availabilityFilter.length > 0;

  function limpiarFiltros() {
    setCategoryFilter([]);
    setStockFilter([]);
    setAvailabilityFilter([]);
  }

  // Dentro de un filtro las opciones suman (panes O facturas); entre filtros
  // se cruzan (panes Y sin stock). Es lo que espera cualquiera que haya usado
  // los filtros de una planilla.
  function matchesDesktopFilters(product: ProductRow): boolean {
    if (categoryFilter.length > 0) {
      const coincide = categoryFilter.some((valor) =>
        valor === CATEGORY_INSUMOS ? product.kind === "INGREDIENT" : product.categoryId === valor,
      );
      if (!coincide) return false;
    }

    if (stockFilter.length > 0) {
      const estado = stockStatusOf(product);
      const coincide = stockFilter.some((valor) =>
        valor === "in" ? estado === "ok" : valor === "low" ? estado === "low" : valor === "out" ? estado === "out" : false,
      );
      if (!coincide) return false;
    }

    if (availabilityFilter.length > 0) {
      const coincide = availabilityFilter.some((valor) =>
        valor === "available" ? product.available : valor === "paused" ? !product.available : false,
      );
      if (!coincide) return false;
    }

    return true;
  }

  const desktopSortedProducts = useMemo(() => {
    const dir: 1 | -1 = sortDir === "asc" ? 1 : -1;
    const list = data.products.filter((product) => matchesDesktopFilters(product) && matchesSearch(product, query));
    list.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "es") * dir;
      if (sortKey === "cost") return compareNullable(a.cost, b.cost, dir);
      if (sortKey === "price") return compareNullable(a.priceValue, b.priceValue, dir);
      if (sortKey === "margin") return compareNullable(margenPct(a.cost, a.priceValue), margenPct(b.cost, b.priceValue), dir);
      return compareNullable(a.stockQuantity, b.stockQuantity, dir);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesDesktopFilters/matchesSearch cierran sobre estos mismos valores.
  }, [data.products, categoryFilter, stockFilter, availabilityFilter, query, categoryNameById, sortKey, sortDir]);

  // Qué se pregunta y en qué orden lo decide el rubro, no este componente.
  const pasos = useMemo(
    () =>
      newProductSteps({
        features: { barcodes: data.features.barcodes, stock: data.features.stock },
        hasCategories: data.categories.length > 0,
        catalogSingular: data.catalogSingular,
        branchName: data.branches.length > 1 ? newBranchName : null,
      }),
    [data.features.barcodes, data.features.stock, data.categories.length, data.catalogSingular, data.branches.length, newBranchName],
  );

  const pasoActual = pasos[Math.min(newStep, pasos.length - 1)];
  const esUltimoPaso = newStep >= pasos.length - 1;

  function resetNew() {
    setNewStep(0);
    setNuevoNombre("");
    if (foto) URL.revokeObjectURL(foto.preview);
    setFoto(null);
  }

  function openNew() {
    setNewBranchId(data.selectedBranchId);
    setNewError(null);
    setCreatedProduct(null);
    resetNew();
    setNewOpen(true);
  }

  // Variante de `openNew` para el "Crear '{q}'" del vacío filtrado: abre el
  // mismo wizard con el nombre ya escrito, para no hacer tipear de nuevo lo
  // que ya se había buscado.
  function openNewWithName(name: string) {
    setNewBranchId(data.selectedBranchId);
    setNewError(null);
    setCreatedProduct(null);
    resetNew();
    setNuevoNombre(name);
    setNewOpen(true);
  }

  function closeNew() {
    setNewOpen(false);
    setNewError(null);
    setCreatedProduct(null);
    resetNew();
    router.refresh();
  }

  // Vuelve al primer paso con todo en blanco, sin cerrar el sheet.
  function crearOtro() {
    setCreatedProduct(null);
    setNewError(null);
    resetNew();
  }

  async function elegirFoto(file: File | undefined) {
    if (!file) return;
    setNewError(null);
    try {
      const resized = await resizeImageForUpload(file);
      if (foto) URL.revokeObjectURL(foto.preview);
      setFoto({ file: resized, preview: URL.createObjectURL(resized) });
    } catch {
      setNewError("No pudimos preparar esa imagen. Probá con otra.");
    }
  }

  function quitarFoto() {
    if (foto) URL.revokeObjectURL(foto.preview);
    setFoto(null);
  }

  function avanzar() {
    if (!puedeAvanzar(pasoActual, nuevoNombre)) {
      setNewError("Poné el nombre para poder seguir.");
      return;
    }
    setNewError(null);
    setNewStep((actual) => Math.min(pasos.length - 1, actual + 1));
  }

  function retroceder() {
    setNewError(null);
    setNewStep((actual) => Math.max(0, actual - 1));
  }

  // Un solo commit al final: el form ya trae todos los pasos, se crea el
  // producto y recién ahí —ya con id— se sube la foto que venía en memoria.
  function submitNewProduct() {
    const form = newFormRef.current;
    if (!form) return;
    const formData = new FormData(form);
    setNewError(null);
    startCreating(async () => {
      const result = await createProduct(formData);
      if (!result.ok) {
        setNewError(result.error);
        return;
      }

      if (foto) {
        const imagen = new FormData();
        imagen.set("productId", result.productId);
        imagen.set("file", foto.file);
        const subida = await uploadProductImage(imagen);
        // El producto ya está creado y es lo que importa: si la foto falla se
        // avisa, pero no se pierde el alta ni se deja al dueño repitiéndola.
        if (!subida.ok) {
          setNewError("Se creó, pero la foto no subió. Cargala desde la ficha.");
        }
      }

      setCreatedProduct({ id: result.productId, name: result.name, description: result.description });
      router.refresh();
    });
  }

  function selectBranch(id: string) {
    startTransition(() => router.push(`/catalog?branchId=${id}`, { scroll: false }));
  }

  const desktopGridClass = data.features.stock ? DESKTOP_GRID_WITH_STOCK : DESKTOP_GRID_NO_STOCK;

  return (
    <main
      className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-foreground lg:max-w-none lg:px-8 duration-300 animate-in fade-in"
      style={
        {
          "--primary": "#0066cc",
          // Apple no oscurece el primario en hover/press: la marca de estado
          // es transform: scale(0.95), no un cambio de color. Se deja igual
          // al primario a propósito.
          "--primary-strong": "#0066cc",
          "--foreground": "#1d1d1f",
          "--background": "#f5f5f7",
        } as React.CSSProperties
      }
    >
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-foreground">{data.catalogPlural}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {/* Talles y códigos de barras solo donde existen: en una verdulería
              esos botones no son ruido, son una invitación a cargar mal. */}
          {data.features.variants ? (
            <VariantGenerator branchId={data.selectedBranchId} categories={data.categories} />
          ) : null}
          {data.features.barcodes ? (
            <CatalogScanButton branchId={data.selectedBranchId} categories={data.categories} units={data.units} />
          ) : null}
          {data.features.stock ? (
            <button
              aria-label="Movimientos"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"
              onClick={() => setMovementsOpen(true)}
              type="button"
            >
              <History className="size-5" />
            </button>
          ) : null}
          {/* En escritorio hay lugar para un botón de verdad en el header; en
              mobile sigue siendo el FAB flotante de siempre (más abajo). */}
          <button
            className="hidden items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-base font-black text-white transition hover:bg-primary-strong active:scale-95 lg:inline-flex"
            onClick={() => openNew()}
            type="button"
          >
            <Plus className="size-4" />
            Nuevo {data.catalogSingular.toLowerCase()}
          </button>
        </div>
      </header>

      {data.branches.length > 1 ? (
        <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pl-1 pr-12 pb-1 duration-500 animate-in fade-in slide-in-from-bottom-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.branches.map((branch) => (
            <button
              className={`shrink-0 snap-start scroll-ml-1 rounded-full px-4 py-2 text-base font-bold transition active:scale-95 ${
                branch.id === data.selectedBranchId ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
              }`}
              key={branch.id}
              onClick={() => selectBranch(branch.id)}
              type="button"
            >
              {branch.name}
            </button>
          ))}
        </div>
      ) : null}

      {data.flash ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-base font-semibold duration-300 animate-in fade-in ${
            data.flash.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {data.flash.message}
        </div>
      ) : null}

      <div className={`mt-4 ${isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}`}>
        {data.products.length === 0 ? (
          <CatalogOnboarding
            branchId={data.selectedBranchId}
            catalogIcon={data.catalogIcon}
            catalogPlural={data.catalogPlural}
            catalogSingular={data.catalogSingular}
            categories={data.categories}
            features={data.features}
            onCreateManually={openNew}
            presetCount={data.presetCount}
            presetHasStock={data.presetHasStock}
            presetSample={data.presetSample}
            units={data.units}
            verticalLabel={data.verticalLabel}
          />
        ) : (
          <>
            {/* Lo que antes era el dashboard de /stock: arriba de la tabla o
                de la lista, en los dos layouts. */}
            {data.features.stock && data.stockTotals ? (
              <div className="mb-4">
                <CatalogSummary
                  catalogPlural={data.catalogPlural}
                  onFilter={(filtro) => {
                    // Los dos layouts llevan su propio filtro (escritorio
                    // combina tres, mobile permite uno solo), así que se
                    // setean los dos: el que no está a la vista no molesta.
                    // En escritorio el filtro es multiselección, así que el
                    // atajo del resumen REEMPLAZA lo que hubiera: si sumara,
                    // tocar "3 por reponer" con otro filtro puesto mostraría
                    // más filas que antes, justo al revés de lo que promete.
                    setStockFilter([filtro]);
                    setMobileFilter(filtro);
                  }}
                  totals={data.stockTotals}
                />
              </div>
            ) : null}

            {/* ── Mobile (< lg): cards + chips ─────────────────────────── */}
            <div className="lg:hidden">
              {data.products.length > 6 ? (
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    aria-label={`Buscar ${data.catalogPlural.toLowerCase()}`}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-3 text-lg font-semibold text-foreground outline-none transition focus:border-primary/40"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Buscar ${data.catalogPlural.toLowerCase()}…`}
                    value={search}
                  />
                </div>
              ) : null}

              <div className="-mx-1 mb-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {mobileChips.map((chip) => {
                  const active = mobileFilter === chip.value;
                  return (
                    <button
                      className={`shrink-0 snap-start rounded-full px-3.5 py-1.5 text-sm font-bold transition active:scale-95 ${
                        active ? "bg-primary text-white" : chip.alert ? "bg-rose-50 text-rose-700" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                      }`}
                      key={chip.value}
                      onClick={() => setMobileFilter((current) => (current === chip.value ? "all" : chip.value))}
                      type="button"
                    >
                      {chip.label} <span className="tabular-nums opacity-70">{chip.count}</span>
                    </button>
                  );
                })}
              </div>

              {mobileVisibleProducts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-base text-slate-500">
                  {search.trim()
                    ? `No encontramos ningún ${data.catalogSingular.toLowerCase()} con eso.`
                    : "Nada con ese filtro."}
                </p>
              ) : (
                <Reveal>
                  <ul className="space-y-2.5">
                    {mobileVisibleProducts.map((product) => {
                      const imageSrc = productImageSrc(product);

                      return (
                        <li data-reveal-item key={product.id}>
                          <button
                            // Apple no pone sombra en cards: la elevación es el hairline
                            // (ring-1) solo, nunca shadow — eso se reserva para la foto
                            // del producto que descansa sobre una superficie.
                            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                            onClick={() => setMobileSheetId(product.id)}
                            type="button"
                          >
                            {imageSrc ? (
                              // Miniatura ya normalizada a 512px por nuestra propia ruta: no
                              // hay nada que `next/image` pueda optimizar.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt=""
                                className="size-11 shrink-0 rounded-2xl object-cover"
                                src={imageSrc}
                              />
                            ) : (
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <DynamicIcon className="size-5" name={data.catalogIcon} />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-black text-foreground">
                                {product.familyName ? (
                                  <>
                                    {product.familyName}{" "}
                                    <span className="font-bold text-slate-500">{product.variantLabel}</span>
                                  </>
                                ) : (
                                  product.name
                                )}
                              </p>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${toneClasses[product.statusTone]}`}>
                                  {product.statusLabel}
                                </span>
                                {/* Cuántos quedan, acá. Antes había que ir a Stock. */}
                                {product.stockQuantity !== null ? (
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                                      product.minStockRaw !== null && product.stockQuantity <= product.minStockRaw
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {formatQuantity(product.stockQuantity, product.unit as never)}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <p className="shrink-0 text-right text-base font-black text-foreground tabular-nums">
                              {product.priceLabel}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>
              )}
            </div>

            {/* ── Escritorio (>= lg): la tabla a todo lo ancho ──────────
                El detalle ya no es una columna fija al costado: entra como
                panel desde la derecha (ver el SidePanel más abajo). Así la
                tabla deja de competir por el ancho con un panel que la mitad
                del tiempo mostraba un "Elegí un producto". */}
            <div className="relative hidden lg:flex lg:items-start lg:gap-4">
              <div className="min-w-0 flex-1">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    aria-label={`Buscar ${data.catalogPlural.toLowerCase()}`}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-3 text-lg font-semibold text-foreground outline-none transition focus:border-primary/40"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, categoría o código…"
                    value={search}
                  />
                </div>

                {/* Barra de filtros, afuera de la tabla. Acá se ve de un
                    vistazo qué está filtrado —adentro de la cabecera era un
                    ícono chiquito que había que ir a buscar columna por
                    columna— y se puede combinar más de una opción por filtro. */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {categoryFilterOptions.length > 1 ? (
                    <MultiFilter label="Categoría" onChange={setCategoryFilter} options={categoryFilterOptions} selected={categoryFilter} />
                  ) : null}
                  {data.features.stock ? (
                    <MultiFilter label="Stock" onChange={setStockFilter} options={stockFilterOptions} selected={stockFilter} />
                  ) : null}
                  <MultiFilter label="Estado" onChange={setAvailabilityFilter} options={availabilityFilterOptions} selected={availabilityFilter} />

                  {hayFiltros ? (
                    <button
                      className="min-h-11 rounded-full px-3 text-sm font-black text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      onClick={limpiarFiltros}
                      type="button"
                    >
                      Limpiar
                    </button>
                  ) : null}

                  <span className="ml-auto text-sm text-slate-500 tabular-nums">
                    {desktopSortedProducts.length} de {data.products.length}
                  </span>
                </div>

                <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-950/5">
                  <div className={`${desktopGridClass} border-b border-slate-100 px-4 py-3`}>
                    <span aria-hidden="true" />
                    {/* La cabecera quedó SOLO para ordenar. Los filtros se
                        fueron a su propia barra arriba de la tabla: metidos acá
                        adentro dejaban la fila de dos alturas —solo las
                        columnas con filtro tenían segunda línea— y encima
                        limitaban a elegir una opción por columna. */}
                    <div className="flex min-w-0 items-center gap-2">
                      <SortButton active={sortKey === "name"} dir={sortDir} label="Producto" onClick={() => toggleSort("name")} />
                    </div>
                    <div className="flex justify-end">
                      <SortButton active={sortKey === "cost"} align="right" dir={sortDir} label="Costo" onClick={() => toggleSort("cost")} />
                    </div>
                    <div className="flex justify-end">
                      <SortButton active={sortKey === "price"} align="right" dir={sortDir} label="Precio" onClick={() => toggleSort("price")} />
                    </div>
                    <div className="flex justify-end">
                      <SortButton active={sortKey === "margin"} align="right" dir={sortDir} label="Margen" onClick={() => toggleSort("margin")} />
                    </div>
                    {data.features.stock ? (
                      <div className="flex items-center justify-end gap-1">
                        <SortButton active={sortKey === "stock"} align="right" dir={sortDir} label="Stock" onClick={() => toggleSort("stock")} />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-center">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">Disponible</span>
                    </div>
                  </div>

                  {desktopSortedProducts.length === 0 ? (
                    <div className="p-10 text-center">
                      {search.trim() ? (
                        <>
                          <p className="text-base text-slate-500">Sin resultados para &quot;{search.trim()}&quot;</p>
                          <button
                            className="mt-3 rounded-full bg-primary px-4 py-2.5 text-base font-black text-white transition hover:bg-primary-strong active:scale-95"
                            onClick={() => openNewWithName(search.trim())}
                            type="button"
                          >
                            Crear &quot;{search.trim()}&quot;
                          </button>
                        </>
                      ) : (
                        <p className="text-base text-slate-500">Nada con estos filtros.</p>
                      )}
                    </div>
                  ) : (
                    <Reveal>
                      {desktopSortedProducts.map((product) => {
                        const categoryName = product.categoryId ? categoryNameById.get(product.categoryId) ?? "" : "";
                        const margin = margenPct(product.cost, product.priceValue);

                        return (
                          <div
                            className="cursor-pointer border-b border-slate-50 outline-none transition last:border-0 hover:bg-slate-50/80 focus-visible:bg-slate-50"
                            data-reveal-item
                            key={product.id}
                            onClick={() => selectDesktopProduct(product.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                selectDesktopProduct(product.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className={`${desktopGridClass} px-4 py-2.5`}>
                              <ProductAvatar product={product} size="size-9" textSize="text-sm" />
                              <div className="min-w-0">
                                <p className="truncate text-base font-bold text-foreground">
                                  {product.familyName ? (
                                    <>
                                      {product.familyName} <span className="font-semibold text-slate-500">{product.variantLabel}</span>
                                    </>
                                  ) : (
                                    product.name
                                  )}
                                </p>
                                <p className="truncate text-sm text-slate-500">
                                  {categoryName || "Sin categoría"} · {product.available ? unitLabel(product.unit as never) : "pausado"}
                                </p>
                              </div>
                              <p className="text-right text-base font-semibold text-slate-500 tabular-nums">
                                {product.cost !== null ? money(product.cost) : "—"}
                              </p>
                              <p className="truncate text-right text-base font-black text-foreground tabular-nums">{product.priceLabel}</p>
                              <p className={`text-right text-base font-black tabular-nums ${margin !== null && margin < 30 ? "text-rose-600" : "text-slate-500"}`}>
                                {margin !== null ? `${margin}%` : "—"}
                              </p>
                              {data.features.stock ? (
                                <div className="flex justify-end">
                                  <StockBadge product={product} />
                                </div>
                              ) : null}
                              <div className="flex justify-center">
                                <AvailabilityQuickToggle branchId={data.selectedBranchId} onChanged={() => router.refresh()} product={product} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </Reveal>
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      {/* Alta de un ítem del catálogo. `dialog` como el sheet de edición: el
          formulario usa `sm:grid-cols-2`, que mira el ANCHO DE PANTALLA, no el
          del panel. En escritorio se partía en dos columnas dentro de un panel
          de 460px y "¿Cuánto te cuesta?" quedaba cortado con scroll horizontal. */}
      <BottomSheet onClose={closeNew} open={newOpen} panelClassName={sheetVars} size="dialog">
        {createdProduct ? (
          /* Confirmación y nada más. La foto ya se preguntó como paso del alta:
             volver a pedirla acá era hacerle el mismo trámite dos veces. */
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-wide text-emerald-600">Listo</p>
                <h3 className="truncate text-2xl font-semibold tracking-tight text-foreground">{createdProduct.name}</h3>
              </div>
              <button
                aria-label="Cerrar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-95"
                onClick={closeNew}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-6" />
                </span>
                <p className="text-lg font-bold leading-snug text-emerald-900">
                  Ya está en tu {data.catalogPlural.toLowerCase()}. Podés cambiarle lo que sea desde su ficha.
                </p>
              </div>
              {newError ? (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-base font-bold text-amber-700">{newError}</p>
              ) : null}
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <div className="flex items-center gap-3">
                {/* Cargar catálogo es una tarea repetitiva: obligar a cerrar y
                    volver a abrir por cada ítem es cobrarle dos toques a algo
                    que se hace veinte veces seguidas. */}
                <button
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 text-lg font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                  onClick={crearOtro}
                  type="button"
                >
                  Cargar otro
                </button>
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-4 text-lg font-black text-white transition hover:bg-primary-strong active:scale-[0.99]"
                  onClick={closeNew}
                  type="button"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        ) : (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => event.preventDefault()}
          ref={newFormRef}
        >
          <input name="branchId" type="hidden" value={newBranchId} />
          <div className="flex items-start justify-between gap-3 px-5 pt-6">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-wide text-primary">
                Paso {newStep + 1} de {pasos.length}
              </p>
              <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-foreground">{pasoActual.title}</h3>
              <p className="mt-1 text-lg leading-snug text-slate-500">{pasoActual.subtitle}</p>
            </div>
            <button
              aria-label="Cerrar"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
              onClick={closeNew}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="px-5 pt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${((newStep + 1) / pasos.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Los campos de TODOS los pasos quedan montados; sólo se muestra el
              del paso actual. Así volver atrás no borra lo cargado y el submit
              final manda todo junto, sin duplicar el valor en estado. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            <div className="space-y-4" hidden={pasoActual.id !== "identidad"}>
              <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                Nombre
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-foreground outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  name="name"
                  onChange={(event) => setNuevoNombre(event.target.value)}
                  placeholder={`Ej: ${data.catalogSingular}`}
                  type="text"
                  value={nuevoNombre}
                />
              </label>
              <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                Descripción (opcional)
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-foreground outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  name="description"
                  placeholder="Ej: incluye lavado"
                  type="text"
                />
              </label>
            </div>

            <div className="space-y-4" hidden={pasoActual.id !== "foto"}>
              {foto ? (
                <div className="space-y-3">
                  {/* La única sombra de todo el sistema Apple es esta: la foto
                      del producto apoyada sobre una superficie. En ningún otro
                      lado de esta pantalla —cards, botones— hay shadow. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob local, todavía no hay producto ni URL servida */}
                  <img
                    alt={`Vista previa de ${nuevoNombre || "la foto"}`}
                    className="mx-auto aspect-square w-full max-w-xs rounded-3xl object-cover shadow-[3px_5px_30px_rgba(0,0,0,0.22)]"
                    src={foto.preview}
                  />
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-base font-black text-slate-600 transition hover:bg-slate-50"
                    onClick={quitarFoto}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                    Quitar la foto
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center transition hover:border-primary/40 hover:bg-white">
                  <Plus className="size-8 text-slate-400" />
                  <span className="text-base font-black text-slate-600">Elegir una foto</span>
                  <span className="text-sm text-slate-500">Se guarda recién al crear. Podés saltear este paso.</span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => elegirFoto(event.target.files?.[0])}
                    type="file"
                  />
                </label>
              )}
            </div>

            <div className="space-y-4" hidden={pasoActual.id !== "precio"}>
              {data.branches.length > 1 ? (
                <BranchSelect branches={data.branches} onChange={setNewBranchId} value={newBranchId} />
              ) : null}
              <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                {newBranchName ? `Precio en ${newBranchName} (opcional)` : "Precio (opcional)"}
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                  <span className="text-xl font-black text-slate-600">$</span>
                  <MoneyInput
                    className="w-full bg-transparent px-2 py-3.5 text-xl font-black text-foreground tabular-nums outline-none"
                    name="price"
                    placeholder="0"
                  />
                </div>
              </label>
            </div>

            {/* Cuántos tenés, acá y ahora. Sin esto hay que ir a Stock y
                buscar el producto de nuevo, uno por uno. */}
            {data.features.stock ? (
              <div className="space-y-4" hidden={pasoActual.id !== "existencia"}>
                <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                  ¿Cuántos tenés? (opcional)
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-foreground tabular-nums outline-none transition focus:border-primary/40 focus:bg-white"
                    inputMode="decimal"
                    name="stock"
                    placeholder="Ej: 12"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                  ¿Cuánto te cuesta? (opcional)
                  <MoneyInput
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-foreground tabular-nums outline-none transition focus:border-primary/40 focus:bg-white"
                    name="cost"
                    placeholder="$"
                  />
                </label>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  El costo es lo que pagaste, no lo que cobrás. Sin él la ganancia queda inflada y te lo vamos a avisar
                  en el panel.
                </p>
              </div>
            ) : null}

            {/* El código va en el alta y no sólo en la edición: donde se escanea,
                crear el ítem y tener que volver a abrirlo para cargarle el
                código es hacer dos viajes por lo mismo. */}
            {data.features.barcodes ? (
              <div className="space-y-4" hidden={pasoActual.id !== "codigo"}>
                <label className="grid gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
                  Código de barras (opcional)
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-lg font-semibold text-foreground outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                    inputMode="numeric"
                    name="barcode"
                    placeholder="779…"
                    type="text"
                  />
                </label>
              </div>
            ) : null}

            {data.categories.length > 0 ? (
              <div className="space-y-4" hidden={pasoActual.id !== "categoria"}>
                {/* El desplegable propio y no un <select>: la lista nativa la
                    dibuja el sistema operativo y no hay CSS que la toque. */}
                <div className="grid gap-2">
                  <span className="text-sm font-black uppercase tracking-wide text-slate-500">Categoría (opcional)</span>
                  <SelectField
                    ariaLabel="Categoría"
                    name="categoryId"
                    options={[
                      { value: "", label: "Sin categoría" },
                      ...data.categories.map((category) => ({ value: category.id, label: category.name })),
                    ]}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            {newError ? (
              <p className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-base font-bold text-rose-600">{newError}</p>
            ) : null}
            <div className="flex items-center gap-3">
              {newStep > 0 ? (
                <button
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 active:scale-95"
                  aria-label="Volver al paso anterior"
                  onClick={retroceder}
                  type="button"
                >
                  <ArrowLeft className="size-5" />
                </button>
              ) : null}
              {/* Los `key` distintos son a propósito: sin ellos React reutiliza
                  el mismo nodo para "Seguir" y para "Crear" —misma posición del
                  árbol— y el botón cambia de identidad debajo del dedo del
                  usuario en pleno click. */}
              {esUltimoPaso ? (
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-4 text-lg font-black text-white transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
                  disabled={isCreating}
                  key="crear"
                  onClick={submitNewProduct}
                  type="button"
                >
                  {isCreating ? <Loader2 className="size-5 animate-spin" /> : null}
                  {isCreating ? "Creando…" : `Crear ${data.catalogSingular.toLowerCase()}`}
                </button>
              ) : (
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-4 text-lg font-black text-white transition hover:bg-primary-strong active:scale-[0.99]"
                  key="seguir"
                  onClick={avanzar}
                  type="button"
                >
                  Seguir
                  <ArrowRight className="size-5" />
                </button>
              )}
            </div>
          </div>
        </form>
        )}
      </BottomSheet>

      {/* Panel rápido de mobile: foto protagonista, casi a pantalla completa
          (92dvh, el máximo que se banca BottomSheet manteniendo el handle
          de arrastre). Todo el producto —detalles, movimientos, análisis—
          se edita acá adentro, con pestañas (ver ProductQuickPanelBody). */}
      <BottomSheet
        handleOverlay
        onClose={closeMobilePanel}
        open={mobileSheetId !== null}
        panelClassName={`${sheetVars} min-h-[92dvh]`}
      >
        {mobileSelectedProduct ? (
          <ProductPanel data={data} key={mobileSelectedProduct.id} onClose={closeMobilePanel} product={mobileSelectedProduct} variant="sheet" />
        ) : null}
      </BottomSheet>

      {/* El mismo panel, en escritorio, entrando desde la derecha. Se abre solo
          desde la tabla (la única que setea `desktopSelectedId`, y que está
          oculta abajo de lg), así que no hace falta condicionarlo por ancho:
          en el celular nada lo abre. */}
      <SidePanel
        className={sheetVars}
        onClose={closeDesktopPanel}
        open={desktopSelectedProduct !== null}
        title={desktopSelectedProduct ? desktopSelectedProduct.name : data.catalogSingular}
      >
        {desktopSelectedProduct ? (
          <ProductPanel
            data={data}
            key={desktopSelectedProduct.id}
            onClose={closeDesktopPanel}
            product={desktopSelectedProduct}
            variant="panel"
          />
        ) : null}
      </SidePanel>

      {data.features.stock ? <MovementsSheet data={data} onClose={() => setMovementsOpen(false)} open={movementsOpen} /> : null}

      <button
        aria-label={`Nuevo ${data.catalogSingular.toLowerCase()}`}
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8 lg:hidden"
        onClick={openNew}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
