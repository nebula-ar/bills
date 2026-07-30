"use client";

import { createProduct, updateProduct } from "@/app/catalog/actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CatalogScanButton } from "@/components/catalog-scan-button";
import { VariantGenerator } from "@/components/variant-generator";
import { CatalogOnboarding } from "@/components/catalog-onboarding";
import { ProductStockPanel } from "@/components/product-stock-panel";
import { ProductPhotoField } from "@/components/product-photo-field";
import { formatQuantity } from "@/lib/quantity";
import { Check, ChevronDown, CircleSlash, DynamicIcon, Plus, Search, X } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  hasPhoto: boolean;
  imageVersion: number | null;
  // Modelo con talles: se muestra el modelo + la variante.
  familyName: string | null;
  variantLabel: string | null;
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
};

const sheetInput =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

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
      <div className="relative">
        <select
          className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-11 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      </div>
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
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
        onClick={() => setOn((value) => !value)}
        role="switch"
        type="button"
      >
        <span
          className="absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: on ? "translateX(1.25rem)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

export function ProductsManager({ data }: { data: ProductsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  // El catálogo es la puerta de entrada a cambiar un precio y a corregir stock.
  // Con 60 productos, sin buscador es scroll puro — y el mostrador ya tenía uno.
  const [search, setSearch] = useState("");
  const [newBranchId, setNewBranchId] = useState(data.selectedBranchId);
  const [editId, setEditId] = useState<string | null>(null);
  const [editBranchId, setEditBranchId] = useState(data.selectedBranchId);
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

  function openNew() {
    setNewBranchId(data.selectedBranchId);
    setNewOpen(true);
  }

  function openEdit(id: string) {
    setEditBranchId(data.selectedBranchId);
    setEditId(id);
  }

  function selectBranch(id: string) {
    startTransition(() => router.push(`/catalog?branchId=${id}`, { scroll: false }));
  }

  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-28 pt-6 text-slate-950 lg:max-w-[1080px] lg:px-8">
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
                branch.id === data.selectedBranchId ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
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
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400"
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
            {visibleProducts.map((product, index) => (
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
                  {product.hasPhoto ? (
                    // Miniatura ya normalizada a 512px por nuestra propia ruta: no
                    // hay nada que `next/image` pueda optimizar.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="size-11 shrink-0 rounded-2xl object-cover"
                      src={`/api/products/${product.id}/image?v=${product.imageVersion}`}
                    />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
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
            ))}
          </ul>
          </>
        )}
      </div>

      {/* Alta de un ítem del catálogo */}
      <BottomSheet onClose={() => setNewOpen(false)} open={newOpen}>
        <form action={createProduct} className="flex min-h-0 flex-1 flex-col">
          <input name="branchId" type="hidden" value={newBranchId} />
          <div className="flex items-center justify-between px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">Nuevo {data.catalogSingular.toLowerCase()}</h3>
            <button
              aria-label="Cerrar"
              className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setNewOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5">
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Nombre
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                name="name"
                placeholder="Ej: Corte clásico"
                required
                type="text"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              Descripción (opcional)
              <input
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                name="description"
                placeholder="Ej: incluye lavado"
                type="text"
              />
            </label>
            {data.branches.length > 1 ? (
              <BranchSelect branches={data.branches} onChange={setNewBranchId} value={newBranchId} />
            ) : null}
            <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
              {newBranchName ? `Precio en ${newBranchName} (opcional)` : "Precio (opcional)"}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                <span className="text-lg font-black text-slate-400">$</span>
                <input
                  className="w-full bg-transparent px-2 py-3.5 text-lg font-black text-slate-950 outline-none"
                  inputMode="numeric"
                  min={1}
                  name="price"
                  placeholder="0"
                  step={1}
                  type="number"
                />
              </div>
            </label>
            {/* Cuántos tenés, acá y ahora. Sin esto hay que ir a Stock y
                buscar el producto de nuevo, uno por uno. */}
            {data.features.stock ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  ¿Cuántos tenés? (opcional)
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white"
                    inputMode="decimal"
                    name="stock"
                    placeholder="Ej: 12"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                  ¿Cuánto te cuesta? (opcional)
                  <input
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white"
                    inputMode="numeric"
                    name="cost"
                    placeholder="$"
                  />
                </label>
              </div>
            ) : null}

            {data.categories.length > 0 ? (
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Categoría (opcional)
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white"
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
            ) : null}

            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Se agrega al catálogo del negocio. Si le ponés precio, queda listo para vender
              {newBranchName ? ` en ${newBranchName}` : ""}. Si no, cargalo después en cada sucursal.
            </p>
          </div>
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
              type="submit"
            >
              Crear {data.catalogSingular.toLowerCase()}
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Configurar precio/disponibilidad */}
      <BottomSheet onClose={() => setEditId(null)} open={editing !== null} size="dialog">
        {editing ? (
          <form action={updateProduct} className="flex min-h-0 flex-1 flex-col" key={editing.id}>
            <input name="branchId" type="hidden" value={editBranchId} />
            <input name="productId" type="hidden" value={editing.id} />
            <input name="configured" type="hidden" value={editConfig?.configured ? "true" : "false"} />
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 pb-3 pt-4">
              <h3 className="text-xl font-black tracking-tight text-slate-950">Editar {data.catalogSingular.toLowerCase()}</h3>
              <button
                aria-label="Cerrar"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
                onClick={() => setEditId(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-5 sm:grid sm:grid-cols-2 sm:items-start sm:gap-x-5 sm:space-y-0 sm:[&>*]:mb-4">
              {/* La existencia y sus operaciones, sin salir de la ficha. */}
              {data.features.stock ? (
                <ProductStockPanel
                  branchId={data.selectedBranchId}
                  branchName={data.selectedBranchName}
                  minStock={editing.minStockRaw}
                  productId={editing.id}
                  quantity={editing.stockQuantity}
                  unit={editing.unit as never}
                />
              ) : null}

              {!editConfig?.configured ? (
                <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  <CircleSlash className="size-4 shrink-0" />
                  Sin precio{editBranchName ? ` en ${editBranchName}` : " en esta sucursal"} — cargalo para poder venderlo.
                </p>
              ) : null}
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                {editBranchName ? `Precio en ${editBranchName}` : "Precio en esta sucursal"}
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <span className="text-lg font-black text-slate-400">$</span>
                  <input
                    className="w-full bg-transparent px-2 py-3.5 text-lg font-black text-slate-950 outline-none"
                    defaultValue={editConfig?.priceValue ?? ""}
                    inputMode="numeric"
                    key={editBranchId}
                    min={1}
                    name="price"
                    placeholder="0"
                    step={1}
                    type="number"
                  />
                </div>
              </label>
              <AvailabilityToggle defaultOn={editConfig?.available || !editConfig?.configured} key={editBranchId} />

              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Nombre
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  defaultValue={editing.name}
                  name="name"
                  required
                  type="text"
                />
              </label>
              {data.branches.length > 1 ? (
                <BranchSelect branches={data.branches} onChange={setEditBranchId} value={editBranchId} />
              ) : null}

              <ProductPhotoField
                hasPhoto={editing.hasPhoto}
                productId={editing.id}
                version={editing.imageVersion}
              />
              <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Descripción (opcional)
                <input
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  defaultValue={editing.description ?? ""}
                  name="description"
                  type="text"
                />
              </label>

              {/* Datos comerciales: solo tienen sentido con stock o códigos. */}
              <input name="hasCommercialFields" type="hidden" value="true" />
              <details className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3" open={editing.trackStock}>
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">
                  Códigos, costo y stock
                </summary>
                <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Tipo
                    <select className={sheetInput} defaultValue={editing.kind} name="kind">
                      <option value="SERVICE">Servicio (no lleva stock)</option>
                      <option value="GOOD">Producto físico</option>
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Se vende por
                    <select className={sheetInput} defaultValue={editing.unit} name="unit">
                      {data.units.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
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
                    <input
                      className={sheetInput}
                      defaultValue={editing.cost ?? ""}
                      inputMode="numeric"
                      name="cost"
                      placeholder="$"
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Categoría
                    <select className={sheetInput} defaultValue={editing.categoryId ?? ""} name="categoryId">
                      <option value="">Sin categoría</option>
                      {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
                    <input defaultChecked={editing.trackStock} name="trackStock" type="checkbox" />
                    Controlar stock (descuenta al vender y avisa cuando falta)
                  </label>
                  <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500 sm:col-span-2">
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
              </details>
            </div>
            <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
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
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={openNew}
        type="button"
      >
        <Plus className="size-6" />
      </button>
    </main>
  );
}
