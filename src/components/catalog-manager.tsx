"use client";

import { createProduct, updateProduct, uploadProductImage } from "@/app/catalog/actions";
import { resizeImageForUpload } from "@/lib/image-resize";
import { newProductSteps, puedeAvanzar } from "@/modules/catalog/new-product-steps.logic";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MoneyInput } from "@/components/money-input";
import { CatalogScanButton } from "@/components/catalog-scan-button";
import { VariantGenerator } from "@/components/variant-generator";
import { CatalogOnboarding } from "@/components/catalog-onboarding";
import { ProductStockPanel } from "@/components/product-stock-panel";
import { ProductPhotoField } from "@/components/product-photo-field";
import { ProductAnalyticsTab } from "@/components/product-analytics-tab";
import { formatQuantity } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { ArrowLeft, ArrowRight, Check, CircleSlash, DynamicIcon, Loader2, Plus, Search, Trash2, X } from "@/components/icons";
import { SelectField } from "@/components/ui/select-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
};

// Un solo estilo de campo para toda la ficha. Antes la pestaña de stock usaba
// uno más chico y con otro fondo, así que al cambiar de pestaña los campos
// cambiaban de forma y parecían de otra pantalla.
const sheetInput =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15";


const toneClasses: Record<ProductRow["statusTone"], string> = {
  available: "bg-emerald-50 text-emerald-700",
  unavailable: "bg-slate-100 text-slate-500",
  unconfigured: "bg-amber-50 text-amber-700",
};

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
    <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
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

function AvailabilityToggle({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3.5">
      <span className="text-sm font-black text-slate-950">Disponible para vender</span>
      {on ? <input name="active" type="hidden" value="on" /> : null}
      <button
        aria-checked={on}
        aria-label="Disponible para vender"
        className={`relative h-11 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
        onClick={() => setOn((value) => !value)}
        role="switch"
        type="button"
      >
        <span
          className="absolute left-1 top-1/2 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)]"
          style={{ transform: on ? "translateY(-50%) translateX(1.25rem)" : "translateY(-50%) translateX(0)" }}
        />
      </button>
    </div>
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<"producto" | "stock" | "analisis">("producto");
  const [editBranchId, setEditBranchId] = useState(data.selectedBranchId);
  const [editStockChanged, setEditStockChanged] = useState(false);
  const editing = data.products.find((product) => product.id === editId) ?? null;
  const newBranchName = data.branches.find((branch) => branch.id === newBranchId)?.name ?? "";
  const editConfig = editing?.branchConfigs.find((config) => config.branchId === editBranchId) ?? null;
  const editBranchName = data.branches.find((branch) => branch.id === editBranchId)?.name ?? "";

  // Sin acentos y sin distinguir mayúsculas: "coca" tiene que encontrar
  // "Coca-Cola" y "banana" tiene que encontrar "Banana".
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const query = normalize(search.trim());
  const visibleProducts = query
    ? data.products.filter((product) =>
        [product.name, product.familyName ?? "", product.sku ?? "", product.barcode ?? ""].some((field) =>
          normalize(field).includes(query),
        ),
      )
    : data.products;

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
  function submitNewProduct(formData: FormData) {
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

  function openEdit(id: string) {
    setEditBranchId(data.selectedBranchId);
    // Siempre en la primera pestaña: si quedara donde la dejó el producto
    // anterior, abrir una ficha mostraría el stock antes que el nombre.
    setEditTab("producto");
    setEditId(id);
  }

  function closeEdit() {
    setEditId(null);
    if (editStockChanged) {
      setEditStockChanged(false);
      router.refresh();
    }
  }

  function selectBranch(id: string) {
    startTransition(() => router.push(`/catalog?branchId=${id}`, { scroll: false }));
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-28 pt-6 text-slate-950 lg:max-w-none lg:px-8">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">{data.catalogPlural}</h1>
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
        </div>
      </header>

      {data.branches.length > 1 ? (
        <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pl-1 pr-12 pb-1 duration-500 animate-in fade-in slide-in-from-bottom-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.branches.map((branch) => (
            <button
              className={`shrink-0 snap-start scroll-ml-1 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                branch.id === data.selectedBranchId ? "bg-primary text-white shadow-sm shadow-primary/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
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
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold duration-300 animate-in fade-in ${
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
            {/* Buscador: el mismo que ya existía en el mostrador. */}
            {data.products.length > 6 ? (
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label={`Buscar ${data.catalogPlural.toLowerCase()}`}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Buscar ${data.catalogPlural.toLowerCase()}…`}
                  value={search}
                />
              </div>
            ) : null}

            {visibleProducts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No encontramos ningún {data.catalogSingular.toLowerCase()} con eso.
              </p>
            ) : null}

          <ul className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {visibleProducts.map((product, index) => {
              const imageSrc = productImageSrc(product);

              return (
              <li
                className="duration-500 animate-in fade-in slide-in-from-bottom-2"
                key={product.id}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms`, animationFillMode: "backwards" }}
              >
                <button
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-950/5 transition active:scale-[0.99]"
                  onClick={() => openEdit(product.id)}
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
                    <p className="truncate text-sm font-black text-slate-950">
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
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${toneClasses[product.statusTone]}`}>
                        {product.statusLabel}
                      </span>
                      {/* Cuántos quedan, acá. Antes había que ir a Stock. */}
                      {product.stockQuantity !== null ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${
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
                  <p className="shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {product.priceLabel}
                  </p>
                </button>
              </li>
              );
            })}
          </ul>
          </>
        )}
      </div>

      {/* Alta de un ítem del catálogo. `dialog` como el sheet de edición: el
          formulario usa `sm:grid-cols-2`, que mira el ANCHO DE PANTALLA, no el
          del panel. En escritorio se partía en dos columnas dentro de un panel
          de 460px y "¿Cuánto te cuesta?" quedaba cortado con scroll horizontal. */}
      <BottomSheet onClose={closeNew} open={newOpen} size="dialog">
        {createdProduct ? (
          /* Confirmación y nada más. La foto ya se preguntó como paso del alta:
             volver a pedirla acá era hacerle el mismo trámite dos veces. */
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3 px-5 pt-6">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-600">Listo</p>
                <h3 className="truncate text-xl font-black tracking-tight text-slate-950">{createdProduct.name}</h3>
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
                <p className="text-sm font-bold leading-6 text-emerald-900">
                  Ya está en tu {data.catalogPlural.toLowerCase()}. Podés cambiarle lo que sea desde su ficha.
                </p>
              </div>
              {newError ? (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{newError}</p>
              ) : null}
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <div className="flex items-center gap-3">
                {/* Cargar catálogo es una tarea repetitiva: obligar a cerrar y
                    volver a abrir por cada ítem es cobrarle dos toques a algo
                    que se hace veinte veces seguidas. */}
                <button
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 text-base font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                  onClick={crearOtro}
                  type="button"
                >
                  Cargar otro
                </button>
                <button
                  className="flex-1 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
                  onClick={closeNew}
                  type="button"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        ) : (
        <form action={submitNewProduct} className="flex min-h-0 flex-1 flex-col">
          <input name="branchId" type="hidden" value={newBranchId} />
          <div className="flex items-start justify-between gap-3 px-5 pt-6">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-primary">
                Paso {newStep + 1} de {pasos.length}
              </p>
              <h3 className="mt-1 text-xl font-black leading-tight tracking-tight text-slate-950">{pasoActual.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{pasoActual.subtitle}</p>
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
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Nombre
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  name="name"
                  onChange={(event) => setNuevoNombre(event.target.value)}
                  placeholder={`Ej: ${data.catalogSingular}`}
                  type="text"
                  value={nuevoNombre}
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Descripción (opcional)
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                  name="description"
                  placeholder="Ej: incluye lavado"
                  type="text"
                />
              </label>
            </div>

            <div className="space-y-4" hidden={pasoActual.id !== "foto"}>
              {foto ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob local, todavía no hay producto ni URL servida */}
                  <img
                    alt={`Vista previa de ${nuevoNombre || "la foto"}`}
                    className="mx-auto aspect-square w-full max-w-xs rounded-3xl object-cover shadow-sm"
                    src={foto.preview}
                  />
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
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
                  <span className="text-sm font-black text-slate-600">Elegir una foto</span>
                  <span className="text-xs text-slate-500">Se guarda recién al crear. Podés saltear este paso.</span>
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
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                {newBranchName ? `Precio en ${newBranchName} (opcional)` : "Precio (opcional)"}
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                  <span className="text-lg font-black text-slate-600">$</span>
                  <MoneyInput
                    className="w-full bg-transparent px-2 py-3.5 text-lg font-black text-slate-950 outline-none"
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
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  ¿Cuántos tenés? (opcional)
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white"
                    inputMode="decimal"
                    name="stock"
                    placeholder="Ej: 12"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  ¿Cuánto te cuesta? (opcional)
                  <MoneyInput
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white"
                    name="cost"
                    placeholder="$"
                  />
                </label>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
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
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Código de barras (opcional)
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
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
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Categoría (opcional)
                  <select
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white"
                    name="categoryId"
                  >
                    <option value="">Sin categoría</option>
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>

          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            {newError ? (
              <p className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{newError}</p>
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
              {esUltimoPaso ? (
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
                  disabled={isCreating}
                  type="submit"
                >
                  {isCreating ? <Loader2 className="size-5 animate-spin" /> : null}
                  {isCreating ? "Creando…" : `Crear ${data.catalogSingular.toLowerCase()}`}
                </button>
              ) : (
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
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

      {/* Configurar precio/disponibilidad */}
      <BottomSheet onClose={closeEdit} open={editing !== null} size="dialog">
        {editing ? (
          <form action={updateProduct} className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <input name="branchId" type="hidden" value={editBranchId} />
            <input name="productId" type="hidden" value={editing.id} />
            <input name="configured" type="hidden" value={editConfig?.configured ? "true" : "false"} />
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 pb-3 pt-4">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Editar {data.catalogSingular.toLowerCase()}</h3>
              <button
                aria-label="Cerrar"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-90"
                onClick={closeEdit}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            {/* Dos pestañas. La ficha mezclaba lo que se mira todos los días
                —nombre, precio, foto— con lo que se configura una vez —códigos,
                costo, mínimos, bultos— y para llegar a lo segundo había que
                scrollear pasando por lo primero.

                Se ocultan con CSS y NO se desmontan: es un solo <form>, y un
                campo desmontado no se envía. Cambiar de pestaña borraría en
                silencio lo que el usuario escribió del otro lado. */}
            <div className="flex shrink-0 gap-2 border-b border-slate-100 bg-white px-5 pt-3">
              {(
                [
                  { key: "producto", label: data.catalogSingular },
                  { key: "stock", label: data.features.stock ? "Stock y códigos" : "Códigos y costo" },
                  { key: "analisis", label: "Análisis" },
                ] as const
              ).map((pestana) => (
                <button
                  className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-black transition ${
                    editTab === pestana.key
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                  key={pestana.key}
                  onClick={() => setEditTab(pestana.key)}
                  type="button"
                >
                  {pestana.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            {/* El `hidden` NO se combina con las clases del layout: `sm:grid`
                vive en una media query y le gana a `hidden`, así que el panel
                se seguía viendo en escritorio y las dos pestañas aparecían
                juntas. Oculto significa oculto y nada más. */}
            {/* Dos columnas con un reparto explícito, no un grid que va
                acomodando en orden de lectura: así la foto caía al lado del
                nombre por casualidad y abajo a la derecha quedaba un hueco.
                Izquierda la identidad —cómo se ve y si se vende—, derecha los
                datos que se escriben. */}
            <div className={editTab === "producto" ? "grid gap-5 sm:grid-cols-[15rem_1fr]" : "hidden"}>
              <div className="space-y-4">
                <ProductPhotoField
                  aiEnabled={data.aiImagesEnabled}
                  catalogSlug={editing.catalogSlug}
                  hasPhoto={editing.hasPhoto}
                  productDescription={editing.description}
                  productId={editing.id}
                  productName={editing.name}
                  version={editing.imageVersion}
                />
                <AvailabilityToggle defaultOn={editConfig?.available || !editConfig?.configured} key={editBranchId} />
              </div>

              <div className="space-y-4">
                {!editConfig?.configured ? (
                  <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                    <CircleSlash className="size-4 shrink-0" />
                    Sin precio{editBranchName ? ` en ${editBranchName}` : " en esta sucursal"} — cargalo para poder venderlo.
                  </p>
                ) : null}

                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Nombre
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                    defaultValue={editing.name}
                    name="name"
                    required
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  {editBranchName ? `Precio en ${editBranchName}` : "Precio en esta sucursal"}
                  <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                    <span className="text-lg font-black text-slate-600">$</span>
                    <MoneyInput
                      className="w-full bg-transparent px-2 py-3.5 text-lg font-black text-slate-950 outline-none"
                      defaultValue={editConfig?.priceValue ?? ""}
                      key={editBranchId}
                      name="price"
                      placeholder="0"
                    />
                  </div>
                </label>

                {/* Pegado al precio y no en otra pestaña: el descuento es la
                    razón por la que el precio que se escribe acá no es el que
                    se va a cobrar. Sin esto se termina bajando el precio a mano
                    sobre una promo que ya está descontando.

                    Se avisa, no se edita: las promos se arman en su pantalla,
                    donde se elige vigencia, mínimos y a qué alcanza. Y no se
                    dice CUÁNTO descuenta porque eso depende del carrito entero
                    —mínimos por monto, NxM, combos—; decir un número acá que
                    después no coincida con la caja sería peor que no decirlo. */}
                {editing.promociones.length > 0 ? (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      Tiene descuento activo
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {editing.promociones.map((promocion) => (
                        <span
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200"
                          key={promocion.id}
                          title={promocion.name}
                        >
                          {promocion.label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-emerald-800/80">
                      Se aplica solo al cobrar, sobre este precio.{" "}
                      <Link className="font-black underline" href="/promotions">
                        Ver promociones
                      </Link>
                    </p>
                  </div>
                ) : null}

                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  Descripción (opcional)
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                    defaultValue={editing.description ?? ""}
                    name="description"
                    type="text"
                  />
                </label>

                {data.branches.length > 1 ? (
                  <BranchSelect branches={data.branches} onChange={setEditBranchId} value={editBranchId} />
                ) : null}
              </div>

            </div>

            {/* Pestaña de stock y códigos. */}
            <div className={editTab === "stock" ? "space-y-4" : "hidden"}>
              {/* La existencia y sus operaciones, arriba de todo: es lo que se
                  viene a hacer acá, y lo de abajo se configura una vez. */}
              {data.features.stock ? (
                <ProductStockPanel
                  branchId={data.selectedBranchId}
                  branchName={data.selectedBranchName}
                  minStock={editing.minStockRaw}
                  onChanged={() => setEditStockChanged(true)}
                  productId={editing.id}
                  quantity={editing.stockQuantity}
                  unit={editing.unit as never}
                />
              ) : null}

              <input name="hasCommercialFields" type="hidden" value="true" />
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Tipo
                    {/* De acá sale si lleva stock: un servicio no tiene
                        existencias y un producto físico sí. Antes había además
                        un tilde "Controlar stock" que decía lo mismo y permitía
                        guardar la contradicción. */}
                    <SelectField
                      ariaLabel="Tipo"
                      defaultValue={editing.kind}
                      name="kind"
                      options={[
                        { value: "GOOD", label: "Producto físico (lleva stock)" },
                        { value: "SERVICE", label: "Servicio (no lleva stock)" },
                      ]}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Se vende por
                    <SelectField
                      ariaLabel="Se vende por"
                      defaultValue={editing.unit}
                      name="unit"
                      options={data.units.map((unit) => ({ value: unit.value, label: unit.label }))}
                    />
                  </label>
                  {data.features.barcodes ? (
                    <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                      Código de barras
                      <input className={sheetInput} defaultValue={editing.barcode ?? ""} name="barcode" placeholder="779…" />
                    </label>
                  ) : null}
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    SKU
                    <input className={sheetInput} defaultValue={editing.sku ?? ""} name="sku" placeholder="REM-NEG-M" />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Costo
                    <MoneyInput
                      className={sheetInput}
                      defaultValue={editing.cost ?? ""}
                      name="cost"
                      placeholder="$"
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Categoría
                    <SelectField
                      ariaLabel="Categoría"
                      defaultValue={editing.categoryId ?? ""}
                      name="categoryId"
                      options={[
                        { value: "", label: "Sin categoría" },
                        ...data.categories.map((category) => ({ value: category.id, label: category.name })),
                      ]}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Avisar cuando queden menos de
                    <input
                      className={sheetInput}
                      defaultValue={editing.minStockValue}
                      inputMode="decimal"
                      name="minStock"
                      placeholder="Ej: 5"
                    />
                  </label>
                  {data.features.packs ? (
                    <>
                      <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                        Unidades por bulto
                        <input
                          className={sheetInput}
                          defaultValue={editing.packSize ?? ""}
                          inputMode="numeric"
                          name="packSize"
                          placeholder="Ej: 24"
                        />
                      </label>
                      <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                        Cómo se llama el bulto
                        <input
                          className={sheetInput}
                          defaultValue={editing.packLabel ?? ""}
                          name="packLabel"
                          placeholder="Caja, bulto, docena"
                        />
                      </label>
                    </>
                  ) : null}
              </div>
            </div>

            {/* Pestaña de análisis. Va montada solo cuando está a la vista: no
                tiene campos del <form>, así que desmontarla no pierde nada, y
                al montarse recién ahí se dispara la consulta. */}
            {editTab === "analisis" ? (
              <ProductAnalyticsTab
                activa
                productId={editing.id}
                unidad={editing.unit as never}
                usaStock={data.features.stock}
              />
            ) : null}
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
                type="submit"
              >
                <Check className="size-5" />
                {editConfig?.configured ? "Guardar cambios" : "Habilitar en esta sucursal"}
              </button>
            </div>
          </form>
        ) : null}
      </BottomSheet>

      <button
        aria-label={`Nuevo ${data.catalogSingular.toLowerCase()}`}
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={openNew}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
