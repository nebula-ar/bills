"use client";

import {
  createProduct,
  deleteProductImage,
  toggleProductAvailability,
  updateProduct,
  uploadProductImage,
} from "@/app/catalog/actions";
import { resizeImageForUpload } from "@/lib/image-resize";
import { parseAmountInput } from "@/lib/money";
import { newProductSteps, puedeAvanzar } from "@/modules/catalog/new-product-steps.logic";
import { PageEnter } from "@/components/page-enter";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyInput } from "@/components/money-input";
import { CatalogScanButton } from "@/components/catalog-scan-button";
import { SidePanel } from "@/components/ui/side-panel";
import { NewProductChooser } from "@/components/new-product-chooser";
import { VariantGenerator } from "@/components/variant-generator";
import { CatalogOnboarding } from "@/components/catalog-onboarding";
import { ProductStockPanel } from "@/components/product-stock-panel";
import { NivelDeInventarioPanel } from "@/components/inventory-level-panel";
import { ProductMovements } from "@/components/product-movements";
import { ProductHistory } from "@/components/product-history";
import { ProductPhotoField } from "@/components/product-photo-field";
import { CatalogUploader } from "@/components/catalog-uploader";
import { ProductAnalyticsTab } from "@/components/product-analytics-tab";
import { formatQuantity, QUANTITY_SCALE, unitLabel } from "@/lib/quantity";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import { ArrowLeft, ArrowRight, Check, CircleSlash, DynamicIcon, Loader2, Plus, Search, Trash2, X } from "@/components/icons";
import { SyncSwitch } from "@/components/sync-switch";
import { SyncSelect } from "@/components/sync-select";
import {
  Aggregate,
  AggregateColumnDirective,
  AggregateColumnsDirective,
  AggregateDirective,
  AggregatesDirective,
  ColumnDirective,
  ColumnMenu,
  ColumnsDirective,
  Filter,
  GridComponent,
  Inject,
  Page,
  Reorder,
  Sort,
} from "@syncfusion/ej2-react-grids";
import { SwitchComponent } from "@syncfusion/ej2-react-buttons";
import { UploaderComponent } from "@syncfusion/ej2-react-inputs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

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
  // Precio como número (mismo origen que priceLabel, null = sin precio): la
  // grilla ordena y filtra por ESTE campo. Ordenar por el string formateado
  // compara mal ("$ 1.200" < "$ 9") y el filtro no matchea un número.
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
  // Ideal, igual: en unidades para el input y en milésimas para el medidor.
  idealStockValue: string;
  idealStockRaw: number | null;
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
// Tope de la descripción. Va acá y no suelto en el JSX porque el contador y
// el `maxLength` tienen que decir el MISMO número: si se separan, el cartel
// promete un límite y el campo aplica otro.
const DESCRIPCION_MAX = 200;

const sheetInput =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15";



const moneyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function money(value: number): string {
  return moneyFormatter.format(value);
}

// Margen sobre precio: (1 - costo/precio). Null si falta cualquiera de los dos
// datos o el precio no es válido — nunca se inventa un número cuando falta
// costo o precio (mismo espíritu que el resto del proyecto con `unitCost`
// faltante, ver AGENTS.md).
function margenPct(cost: number | null, price: number | null): number | null {
  if (cost === null || price === null || price <= 0) return null;
  return Math.round((1 - cost / price) * 100);
}

type StockStatus = "out" | "low" | "ok";

// Mutuamente excluyente y con prioridad: sin stock gana aunque también esté
// bajo el mínimo (0 es, por definición, lo más bajo que hay). null = el
// producto no lleva control de stock.
// Totales del pie de la grilla.
//
// Sumar la columna tal cual habría dado números sin sentido, y peor: números
// con pinta de oficiales. Sumar precios unitarios ($9.520 + $5.290 + …) no es
// plata que exista en ningún lado, y sumar existencias mezcla peras con kilos
// —40 unidades + 10 docenas + 2 kg no es "52 de algo"—.
//
// Lo que sí significa algo:
// - Costo  → Σ(costo × existencia): lo que hay inmovilizado en mercadería.
// - Precio → Σ(precio × existencia): lo que daría venderla toda.
// - Margen → se calcula sobre esos DOS totales, no promediando porcentajes.
//   El promedio simple le da el mismo peso a un alfajor que a 60 medialunas.
// - Stock  → cuántos productos, no cuántas unidades, justo por lo de las
//   unidades mezcladas.
//
// Solo entran los que tienen existencia y el dato cargado: un producto sin
// costo no vale cero, no se sabe cuánto vale, y contarlo como cero infla el
// margen (mismo criterio que `unitCost` faltante en AGENTS.md).
type TotalesDeGrilla = {
  productos: number;
  conStock: number;
  porReponer: number;
  costo: number;
  precio: number;
  margen: number | null;
  sinCosto: number;
};

function totalesDe(productos: ProductRow[]): TotalesDeGrilla {
  let conStock = 0;
  let porReponer = 0;
  let costo = 0;
  let precio = 0;
  let sinCosto = 0;

  for (const producto of productos) {
    const estado = stockStatusOf(producto);
    if (estado === "out" || estado === "low") porReponer += 1;

    const existencia = producto.stockQuantity;
    if (existencia === null || existencia <= 0) continue;
    conStock += 1;

    // La existencia viene en milésimas (ver lib/quantity.ts).
    const unidades = existencia / QUANTITY_SCALE;
    // Un producto sin costo no vale cero: no se sabe cuánto vale. Contarlo como
    // cero abarata el total y por lo tanto infla el margen, así que queda
    // afuera y se avisa cuántos son (mismo criterio que `unitCost` en AGENTS.md).
    // Un servicio sin costo no es un hueco, pero acá ya filtramos por existencia
    // y un servicio no lleva stock.
    if (producto.cost === null) sinCosto += 1;
    else costo += producto.cost * unidades;
    if (producto.priceValue !== null) precio += producto.priceValue * unidades;
  }

  return {
    productos: productos.length,
    conStock,
    porReponer,
    costo: Math.round(costo),
    precio: Math.round(precio),
    margen: precio > 0 && costo > 0 ? Math.round((1 - costo / precio) * 100) : null,
    sinCosto,
  };
}


// Cuántos campos de la ficha difieren de lo que está guardado.
//
// Se compara valor contra valor y no "¿tocó una tecla?": escribir un 5 y
// borrarlo deja el formulario igual que como estaba, y avisar "1 cambio sin
// guardar" ahí es una alarma falsa. La plata se normaliza con el mismo parser
// que usa el guardado, así que "$ 3.500" y "3500" cuentan como el mismo valor.
function contarCambios(datos: FormData, producto: ProductRow, config: ProductBranchConfig | null) {
  const texto = (campo: string) => String(datos.get(campo) ?? "").trim();
  const plata = (campo: string) => parseAmountInput(texto(campo));

  const comparaciones: boolean[] = [
    texto("name") !== producto.name,
    plata("price") !== (config?.priceValue ? parseAmountInput(config.priceValue) : null),
    plata("cost") !== producto.cost,
    texto("sku") !== (producto.sku ?? ""),
    texto("barcode") !== (producto.barcode ?? ""),
    texto("minStock") !== producto.minStockValue,
    texto("idealStock") !== producto.idealStockValue,
    texto("description") !== (producto.description ?? "").trim(),
    // El switch de disponibilidad manda el campo `active` —no `available`— y
    // solo cuando está prendido: el input oculto directamente no se dibuja si
    // está apagado (ver SyncSwitch), así que "on" o ausente. Es el mismo par
    // que lee la action al guardar.
    (datos.get("active") === "on") !== (config?.available ?? false),
  ];

  return comparaciones.filter(Boolean).length;
}


// Los botones del pie de la ficha.
//
// Van en su propio componente por una razón concreta: `useFormStatus` solo ve
// el envío desde un HIJO del <form>. Llamado en el componente que renderiza el
// form devuelve `pending: false` para siempre, y el botón nunca avisaría nada.
//
// Mientras guarda: el botón dice qué está haciendo y se bloquea. Sin eso, una
// conexión lenta se siente como un botón que no anda —y el reflejo es apretarlo
// de nuevo, que manda el formulario dos veces. Cancelar también se bloquea:
// cerrar a mitad de un guardado deja al usuario sin saber si quedó o no.
function BotonesDelPie({ onCancelar, texto }: { onCancelar: () => void; texto: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50"
        disabled={pending}
        onClick={onCancelar}
        type="button"
      >
        Cancelar
      </button>
      <button
        // `aria-busy` para que el lector de pantalla anuncie que está
        // trabajando: el spinner es información visual y sin esto no llega.
        aria-busy={pending}
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
        {pending ? "Guardando…" : texto}
      </button>
    </>
  );
}


// La descripción, con su contador.
//
// Vive en su propio componente por rendimiento, no por prolijidad: el contador
// necesita el largo en cada tecla, y si ese estado estuviera en ProductsManager
// —que contiene la grilla entera de EJ2— cada carácter reconstruiría columnas,
// plantillas y agregados. Acá adentro, escribir re-renderiza doce palabras.
//
// El textarea ES el campo del formulario (`name`), sin input oculto que
// duplique el valor: dos representaciones del mismo dato terminan divergiendo.
function CampoDescripcion({ defaultValue, name }: { defaultValue: string; name: string }) {
  const [largo, setLargo] = useState(defaultValue.length);

  return (
    <div className="grid gap-2">
      <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
        Descripción (opcional)
      </span>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 transition focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
        <textarea
          className="w-full resize-none bg-transparent px-4 pb-1 pt-3 text-sm font-semibold normal-case text-slate-950 outline-none"
          defaultValue={defaultValue}
          maxLength={DESCRIPCION_MAX}
          name={name}
          onChange={(event) => setLargo(event.target.value.length)}
          placeholder="Ej: incluye lavado"
          rows={3}
        />
        <p
          className={`px-4 pb-2.5 text-right text-[0.6875rem] font-bold ${
            largo >= DESCRIPCION_MAX ? "text-amber-700" : "text-slate-400"
          }`}
        >
          {largo}/{DESCRIPCION_MAX}
        </p>
      </div>
    </div>
  );
}

function stockStatusOf(product: ProductRow): StockStatus | null {
  if (product.stockQuantity === null) return null;
  if (product.stockQuantity <= 0) return "out";
  if (product.minStockRaw !== null && product.stockQuantity <= product.minStockRaw) return "low";
  return "ok";
}


// Estado sin resultados del grid: el mismo mensaje del listado viejo.
// Disponibilidad accionable DESDE LA FILA.
//
// Pausar y reactivar es lo que más se hace en esta pantalla, y hasta acá
// obligaba a abrir la ficha, tocar el switch y cerrarla: tres pasos y perder
// el lugar en la lista para un tilde. Acá se toca y listo.
//
// Reemplaza también a la columna "Estado", que decía lo mismo en texto: con
// las dos, la fila mostraba dos veces el mismo dato. Sin precio no hay nada
// que vender, así que en ese caso no va un switch apagado —que invita a
// tocarlo sin que pase nada— sino el motivo.
function AvailabilityCell({
  product,
  branchId,
  onChanged,
}: {
  product: ProductRow;
  branchId: string;
  onChanged: () => void;
}) {
  const [saving, startSaving] = useTransition();

  if (product.priceValue === null) {
    return <span className="text-xs font-bold text-amber-700">Sin precio</span>;
  }

  const precio = product.priceValue;

  return (
    // La marca la lee `recordClick` de la grilla para NO abrir la ficha cuando
    // el toque cayó acá: cambiar la disponibilidad no tiene que abrir nada.
    <span className="inline-flex items-center" data-sin-abrir-ficha>
      <SwitchComponent
        aria-label={`Disponible para vender: ${product.name}`}
        change={(args) => {
          const proximo = Boolean(args.checked);
          if (proximo === product.available) return;
          startSaving(async () => {
            const result = await toggleProductAvailability({
              branchId,
              productId: product.id,
              price: precio,
              available: proximo,
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            onChanged();
          });
        }}
        checked={product.available}
        disabled={saving}
      />
    </span>
  );
}

function EmptyProducts({ singular }: { singular: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      <p className="text-sm font-bold text-slate-700">No encontramos ningún {singular} con eso.</p>
    </div>
  );
}

// Abre el selector de archivos del Uploader de EJ2 (que vive oculto: la tarjeta
// visible es la que dibuja el estado). El input de archivo está siempre en el
// DOM aunque el wrapper esté con display:none, así que el click programático
// funciona en todos los navegadores.
function openUploaderPicker(ref: { current: { element: HTMLElement } | null }) {
  ref.current?.element.querySelector<HTMLInputElement>("input[type=file]")?.click();
}

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
      <SyncSelect
        ariaLabel="Sucursal"
        defaultValue={value}
        key={value}
        onChange={onChange}
        options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
      />
    </label>
  );
}

// Id del <form> de la ficha. Los campos del encabezado viven fuera del
// formulario —el encabezado es fijo y el form scrollea— y se enganchan con el
// atributo `form`. Es HTML estándar; sin esto habría que envolver todo el panel
// en el form o duplicar los campos.
const FORM_FICHA = "ficha-producto";

// Sube la foto pendiente. La imagen no viaja como campo del formulario de la
// ficha —es otra action, con su propio FormData— así que se manda aparte al
// guardar.
async function subirFoto(productId: string, archivo: File | null) {
  if (!archivo) return { ok: true as const };

  const datos = new FormData();
  datos.set("productId", productId);
  datos.set("file", archivo);
  return uploadProductImage(datos);
}

// Solo el switch: la etiqueta y la caja las pone quien lo usa. Antes traía su
// propia tarjeta con el texto adentro, y eso lo ataba a vivir en una fila del
// formulario. Ahora vive en el encabezado, al lado del estado que representa.
function AvailabilityToggle({ defaultOn, form }: { defaultOn: boolean; form?: string }) {
  // El valor viaja en el input oculto que solo existe cuando está activado — el
  // mismo contrato que lee la action (`formData.get("active") === "on"`).
  return <SyncSwitch ariaLabel="Disponible para vender" defaultChecked={defaultOn} form={form} name="active" />;
}

export function ProductsManager({ data }: { data: ProductsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreating, startCreating] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  // El contenido del Dialog se monta recién cuando quedó abierto y estable:
  // los componentes EJ2 (RTE, Uploader) no sobreviven a inicializarse con el
  // diálogo cerrado o en plena animación de apertura (NEBU-48, bugs de QA).
  const [newReady, setNewReady] = useState(false);
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
  // Selector de "cómo cargo el producto" y estado de la cámara. La cámara se
  // maneja desde acá —y no adentro de CatalogScanButton— porque quien la abre
  // es el selector, que es un diálogo de esta pantalla.
  const [elegirAlta, setElegirAlta] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  // La descripción se edita con el RichTextEditor (montado solo cuando el paso
  // está a la vista); el texto vive acá para que cambiar de paso no lo pierda.
  // El Uploader del paso foto vive oculto; la tarjeta visible dispara su
  // selector (ver openUploaderPicker).
  const nuevoUploaderRef = useRef<UploaderComponent>(null);
  // La foto viaja ya redimensionada (mismo helper que la ficha) y se sube recién
  // cuando el producto existe: `saveProductImage` lo busca en la base y sin id
  // no hay dónde guardarla.
  const [foto, setFoto] = useState<{ file: File; preview: string } | null>(null);
  // El catálogo es la puerta de entrada a cambiar un precio y a corregir stock.
  // Con 60 productos, sin buscador es scroll puro — y el mostrador ya tenía uno.
  // El buscador NO guarda lo tipeado en estado de React.
  //
  // Este componente contiene la grilla entera de EJ2, así que un `setState` por
  // tecla vuelve a construir todo ese árbol —columnas, plantillas, agregados—
  // aunque los datos no hayan cambiado. Medido acá: 373ms por carácter.
  //
  // El input se maneja solo (no controlado) y lo único que llega a React es la
  // búsqueda ya asentada, 200ms después de la última tecla. Escribir deja de
  // costar renders, y filtrar pasa a ocurrir una vez por palabra en vez de una
  // por letra.
  const [busqueda, setBusqueda] = useState("");
  const busquedaRef = useRef<number | null>(null);

  function buscar(texto: string) {
    if (busquedaRef.current !== null) window.clearTimeout(busquedaRef.current);
    busquedaRef.current = window.setTimeout(() => setBusqueda(texto), 200);
  }

  useEffect(() => () => {
    if (busquedaRef.current !== null) window.clearTimeout(busquedaRef.current);
  }, []);
  const [newBranchId, setNewBranchId] = useState(data.selectedBranchId);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<"producto" | "stock" | "analisis" | "historial">("producto");
  // Precio y costo se leen del <form> al tipear para recalcular el margen en
  // vivo. `MoneyInput` no expone su valor —guarda el suyo propio— así que se
  // toman con FormData desde el onChange del formulario, que sí burbujea.
  const [margenVivo, setMargenVivo] = useState<number | null>(null);
  // Ganancia en pesos por unidad. Va junto al margen porque son dos preguntas
  // distintas: el % dice si el precio está bien puesto, los pesos dicen cuánto
  // deja cada venta. Con 63% de margen sobre $630 y sobre $9.520 el dueño toma
  // decisiones muy distintas, y el porcentaje solo no las distingue.
  const [gananciaViva, setGananciaViva] = useState<number | null>(null);
  // Cuántos campos difieren de lo guardado. No es un booleano "hay cambios":
  // decir CUÁNTOS es lo que deja cerrar sin miedo —o frenar a tiempo— sin
  // tener que releer el formulario entero buscando qué se tocó.
  const [cambios, setCambios] = useState(0);
  // La foto elegida y todavía no guardada. Se aplica al enviar el formulario,
  // junto con el resto: antes se subía sola apenas se elegía, así que "Cancelar"
  // no la deshacía y quedaba una foto que nadie confirmó.
  const [fotoPendiente, setFotoPendiente] = useState<{ archivo: File | null; quitar: boolean } | null>(null);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [editBranchId, setEditBranchId] = useState(data.selectedBranchId);
  const [editStockChanged, setEditStockChanged] = useState(false);
  // Texto plano de la descripción del producto en edición, alimentado por el
  // RichTextEditor y enviado en el input oculto del form.
  // Igual que newReady: el form de la ficha monta cuando el diálogo terminó de
  // abrirse, y se desmonta al cerrar (cada apertura = Uploader/RTE frescos).
  const [editReady, setEditReady] = useState(false);
  const editing = data.products.find((product) => product.id === editId) ?? null;
  const newBranchName = data.branches.find((branch) => branch.id === newBranchId)?.name ?? "";
  const editConfig = editing?.branchConfigs.find((config) => config.branchId === editBranchId) ?? null;
  const editBranchName = data.branches.find((branch) => branch.id === editBranchId)?.name ?? "";

  // El contenido del Dialog monta recién después de la animación de apertura
  // (200ms, ver animationSettings de los diálogos): los componentes EJ2 no se
  // inicializan ni cerrados ni en plena apertura (NEBU-48). Si el evento `open`
  // del Dialog llegara a dispararse antes, setNewReady es idempotente.
  useEffect(() => {
    if (!newOpen) return;
    const timer = window.setTimeout(() => setNewReady(true), 250);
    return () => window.clearTimeout(timer);
  }, [newOpen]);

  useEffect(() => {
    if (!editId) return;
    const timer = window.setTimeout(() => setEditReady(true), 250);
    return () => window.clearTimeout(timer);
  }, [editId]);

  // Sin acentos y sin distinguir mayúsculas: "coca" tiene que encontrar
  // "Coca-Cola" y "banana" tiene que encontrar "Banana".
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const query = normalize(busqueda.trim());
  // Mapa una vez, no un `find` por fila: con 60 productos y 10 categorías eso
  // eran 600 recorridas en cada render de la grilla.
  const categoryNameById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category.name])),
    [data.categories],
  );

  const visibleProducts = query
    ? data.products.filter((product) =>
        [product.name, product.familyName ?? "", product.sku ?? "", product.barcode ?? ""].some((field) =>
          normalize(field).includes(query),
        ),
      )
    : data.products;

  // El margen se calcula acá y viaja como campo de la fila, en vez de salir
  // solo del template de la columna. La grilla no puede ordenar, filtrar ni
  // totalizar una columna que no tiene `field`: sin esto, "Margen" era el único
  // número de la tabla que no se podía ordenar de peor a mejor, que es
  // justamente la pregunta que se le hace a esa columna.
  const gridRows = useMemo(
    () => visibleProducts.map((product) => ({ ...product, margen: margenPct(product.cost, product.priceValue) })),
    [visibleProducts],
  );

  // Sobre qué filas se totaliza el pie: TODAS las que la grilla está mostrando,
  // no la página.
  //
  // El agregado propio de EJ2 recibe únicamente el resultado paginado
  // —verificado en el navegador: `args.result` traía 10 de 11 productos con la
  // página en 10—, así que un total armado con eso cambiaba al pasar de página.
  // Un total que se mueve según dónde estás parado no es un total: es un número
  // que engaña. Cuando hay filtro de columna la lista completa la da la grilla;
  // cuando no, son las filas que ya vienen filtradas por el buscador de arriba.
  const gridRef = useRef<GridComponent>(null);
  const filasTotalizadas = useCallback(() => {
    const grid = gridRef.current;
    if (!grid?.filterSettings?.columns?.length) return gridRows;
    const filtradas = grid.getFilteredRecords();
    return Array.isArray(filtradas) ? (filtradas as ProductRow[]) : gridRows;
  }, [gridRows]);

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

  // Referencia ESTABLE a propósito: si el objeto se recreara en cada render,
  // el base de React de EJ2 lo trataría como un "controlled prop" cambiado,
  // prendería isSelfTriggeredEvent y el refresh interno de la grilla por
  // cambio de dataSource quedaría tragado (las filas nuevas no aparecen en
  // producción; en dev lo enmascara StrictMode).
  const pageSettings = useMemo(() => ({ pageSize: 10, pageSizes: [10, 20, 50] }), []);

  const pasoActual = pasos[Math.min(newStep, pasos.length - 1)];
  const esUltimoPaso = newStep >= pasos.length - 1;

  function resetNew() {
    setNewStep(0);
    setNuevoNombre("");
    if (foto) URL.revokeObjectURL(foto.preview);
    setFoto(null);
  }

  function openNew() {
    setNewReady(false);
    setNewBranchId(data.selectedBranchId);
    setNewError(null);
    setCreatedProduct(null);
    resetNew();
    setNewOpen(true);
  }

  function closeNew() {
    if (!newOpen) return;
    setNewReady(false);
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

  // Estable a propósito (useCallback sin deps, setFoto con updater funcional):
  // el CatalogUploader está memoizado y si esta función cambiara de identidad
  // re-renderizaría y perdería el input (NEBU-48).
  const elegirFoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setNewError(null);
    try {
      const resized = await resizeImageForUpload(file);
      setFoto((prev) => {
        if (prev) URL.revokeObjectURL(prev.preview);
        return { file: resized, preview: URL.createObjectURL(resized) };
      });
      // Vacía la lista interna del Uploader: si el dueño quita la foto y vuelve
      // a elegir el mismo archivo, que cuente como nuevo y no como duplicado
      // (misma mecánica que la ficha).
      nuevoUploaderRef.current?.clearAll();
    } catch (error) {
      setNewError(
        error instanceof Error && error.message === "HEIC_UNSUPPORTED"
          ? "Esa foto es HEIC y este dispositivo no puede procesarla. Convertila a JPG o PNG, o sacala con otra app."
          : "No pudimos preparar esa imagen. Probá con otra.",
      );
    }
  }, []);

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

  // `useCallback` para que la grilla pueda memoizarse: si esta función cambiara
  // de identidad en cada render, el memo de abajo se invalidaría siempre y no
  // serviría de nada.
  const openEdit = useCallback((id: string) => {
    setEditReady(false);
    const product = data.products.find((item) => item.id === id);
    setEditBranchId(data.selectedBranchId);
    // Siempre en la primera pestaña: si quedara donde la dejó el producto
    // anterior, abrir una ficha mostraría el stock antes que el nombre.
    setEditTab("producto");
    // El margen arranca con lo que ya tiene el producto: si esperara al primer
    // tipeo, abrir la ficha mostraría "—" sobre datos que sí existen.
    setMargenVivo(margenPct(product?.cost ?? null, product?.priceValue ?? null));
    setGananciaViva(
      product && product.cost !== null && product.priceValue !== null ? product.priceValue - product.cost : null,
    );
    // Recién abierta no hay nada tocado. Si quedara el conteo de la ficha
    // anterior, abrir un producto mostraría "3 cambios sin guardar" sobre datos
    // que nadie tocó.
    setCambios(0);
    setEditId(id);
  }, [data.products, data.selectedBranchId]);

  function closeEdit() {
    if (!editing) return;
    setEditReady(false);
    setCambios(0);
    // Lo que no se guardó, se descarta: cerrar es cerrar.
    setFotoPendiente(null);
    setFotoError(null);
    setEditId(null);
    if (editStockChanged) {
      setEditStockChanged(false);
      router.refresh();
    }
  }

  // Alta: primero se elige el camino, después se carga.
  //
  // Con códigos de barras hay dos caminos reales (cámara o a mano) y se
  // pregunta. Sin ellos hay uno solo, así que preguntar sería un click de más:
  // se va derecho al formulario.
  function abrirAlta() {
    if (data.features.barcodes) setElegirAlta(true);
    else openNew();
  }

  function elegirManual() {
    setElegirAlta(false);
    openNew();
  }

  function elegirEscaner() {
    setElegirAlta(false);
    setEscaneando(true);
  }

  // Recalcula margen, ganancia y cantidad de cambios a partir del formulario.
  // Se llama con retraso desde el `onChange` del form (ver ahí el porqué).
  const recalculoRef = useRef<number | null>(null);

  function programarRecalculo() {
    if (recalculoRef.current !== null) window.clearTimeout(recalculoRef.current);

    recalculoRef.current = window.setTimeout(() => {
      const form = document.getElementById(FORM_FICHA);
      if (!(form instanceof HTMLFormElement) || !editing) return;

      const datos = new FormData(form);
      const precio = parseAmountInput(String(datos.get("price") ?? ""));
      const costo = parseAmountInput(String(datos.get("cost") ?? ""));

      setMargenVivo(margenPct(costo, precio));
      // Ganancia por unidad. Solo cuando están los dos: con uno solo no es
      // cero, es desconocida, y mostrar "+$9.520" sobre un costo que falta
      // haría creer que ese producto no cuesta nada.
      setGananciaViva(precio !== null && costo !== null ? precio - costo : null);
      setCambios(contarCambios(datos, editing, editConfig) + (fotoPendiente ? 1 : 0));
    }, 150);
  }

  // Si el panel se cierra con un recálculo en vuelo, no queda un timer
  // escribiendo estado sobre una ficha que ya no está.
  useEffect(() => () => {
    if (recalculoRef.current !== null) window.clearTimeout(recalculoRef.current);
  }, []);

  function selectBranch(id: string) {
    startTransition(() => router.push(`/catalog?branchId=${id}`, { scroll: false }));
  }

  // La grilla se memoiza aparte a propósito. Sin esto, cada tecla en un
  // campo de la ficha re-renderiza este componente —el conteo de cambios, el
  // margen vivo— y arrastra la tabla entera con él: la lista parpadea como si
  // se estuviera recargando, y da la impresión de que algo se guardó. No se
  // guarda nada; la ficha escribe recién con "Guardar cambios". Pero la
  // pantalla no debería sugerir lo contrario.
  const grilla = useMemo(
    () => (
        <div className="catalog-card overflow-hidden bg-white shadow-sm ring-1 ring-slate-950/5">
          <GridComponent
            allowFiltering
            allowPaging
            allowReordering
            // Filtro por MENÚ y no por barra: la barra dibujaba una fila de
            // inputs vacíos abajo de cada cabecera, que ocupaba lugar
            // permanente para algo que casi nunca se usa —y con el buscador
            // de arriba, encima, había dos maneras de buscar lo mismo. En
            // el menú de columna sigue estando, pero solo cuando se busca.
            filterSettings={{ type: "Menu" }}
            allowSorting
            allowTextWrap
            cssClass="e-catalog-grid e-gestion-grid e-dashboard-grid"
            dataSource={gridRows}
            emptyRecordTemplate={() => <EmptyProducts singular={data.catalogSingular.toLowerCase()} />}
            height="auto"
            pageSettings={pageSettings}
            ref={gridRef}
            recordClick={(args) => {
              // Tocar la fila abre la ficha, MENOS sobre los controles que
              // hacen lo suyo ahí mismo (el switch de disponibilidad).
              //
              // Se decide acá y no con stopPropagation en el control:
              // Syncfusion escucha con un listener nativo en la fila, que
              // corre ANTES que cualquier handler de React —React delega en
              // la raíz del documento—, así que frenar el evento desde el
              // switch llega tarde y el modal se abría igual.
              const destino = args.target as HTMLElement | undefined;
              if (destino?.closest("[data-sin-abrir-ficha]")) return;

              // `rowData`, NO `data`: el evento de la grilla trae la fila en
              // `rowData` y `args.data` viene siempre undefined, así que
              // tocar la fila no abría nada. Verificado en el navegador
              // leyendo las claves reales del evento.
              const row = (args as { rowData?: ProductRow }).rowData;
              if (row?.id) openEdit(row.id);
            }}
            // Sin selector de columnas y, por lo tanto, sin toolbar: era lo
            // único que quedaba ahí, y una barra entera para un solo control
            // de preferencia no se paga. Al sacar el módulo ColumnChooser
            // también desaparece su entrada del menú de columna, que es el
            // otro lugar donde asomaba.
            //
            // El menú de columna sigue: eso es ordenar y filtrar, que son
            // tareas, no preferencias de quién mira.
            showColumnMenu
            width="100%"
          >
            <ColumnsDirective>
              <ColumnDirective
                field="name"
                headerText={data.catalogPlural}
                template={(product: ProductRow) => {
                  const imageSrc = productImageSrc(product);
                  // La foto es como el dueño reconoce el producto —más
                  // rápido que leyendo el nombre—, así que va a 64px: a 36
                  // no se distinguía una medialuna de una factura. Esquina
                  // de 6px, más cuadrada que redonda, para que la foto se
                  // lea como foto y no como avatar. El anillo la despega
                  // del fondo blanco cuando tiene bordes claros.
                  //
                  // Las medidas (64px y la esquina de 6) viven en
                  // `syncfusion-catalog.css` bajo `.catalog-thumb`, no en
                  // clases de Tailwind: ahí está explicado por qué.
                  //
                  // El placeholder (sin foto) va del mismo tamaño y con la
                  // misma esquina a propósito: si midiera distinto, las
                  // filas sin foto quedarían más bajas y la columna se
                  // vería rota.
                  return (
                    <div className="flex min-w-0 items-center gap-3 py-0.5">
                      {imageSrc ? (
                        // Miniatura ya normalizada a 512px por nuestra propia ruta: no
                        // hay nada que `next/image` pueda optimizar.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="catalog-thumb shrink-0 object-cover ring-1 ring-slate-950/5" src={imageSrc} />
                      ) : (
                        <span className="catalog-thumb flex shrink-0 items-center justify-center bg-primary/10 text-primary">
                          <DynamicIcon className="size-6" name={data.catalogIcon} />
                        </span>
                      )}
                      <div className="min-w-0">
                        {/* Un escalón claro entre el nombre y su contexto:
                            15px semibold contra 13px gris. Antes los dos
                            pesaban casi igual y la fila se leía como un
                            bloque en vez de "esto es, y esto lo describe".

                            El nombre es un <button> de verdad, no un <p>:
                            al sacar la columna "Editar" la ficha se quedaba
                            sin forma de abrirse con teclado —una fila de
                            grilla no es focuseable por sí sola— y eso deja
                            afuera a quien no usa mouse. Además es el patrón
                            esperado: el nombre del registro abre el
                            registro. El click en la fila sigue funcionando
                            igual; que se dispare dos veces sobre el nombre
                            no molesta, `openEdit` con el mismo id es
                            idempotente. */}
                        <button
                          className="block w-full truncate rounded text-left text-[0.9375rem] font-bold leading-tight text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          onClick={() => openEdit(product.id)}
                          type="button"
                        >
                          {product.familyName ? (
                            <>
                              {product.familyName}{" "}
                              <span className="font-semibold text-slate-500">{product.variantLabel}</span>
                            </>
                          ) : (
                            product.name
                          )}
                        </button>
                        {/* Categoría y unidad como subtítulo: son lo que
                            distingue dos productos de nombre parecido
                            ("Medialuna" suelta vs por docena). Acá no
                            cuestan una columna. */}
                        <p className="mt-0.5 truncate text-[0.8125rem] text-slate-500">
                          {categoryNameById.get(product.categoryId ?? "") ?? "Sin categoría"} · {unitLabel(product.unit as never)}
                        </p>
                      </div>
                    </div>
                  );
                }}
                width="auto"
              />
              {/* Columnas secundarias: en pantalla chica queda Producto +
                  Precio. `hideAtMedia` muestra la columna cuando la media
                  query MATCHEA (ver latest-sales-grid.tsx), así que la
                  query es el ancho MÍNIMO en el que aparece.

                  Los cortes son 768 y 1024 a propósito: son los mismos en
                  los que el contenedor se ensancha (`md:max-w-none`,
                  `lg:px-8`). Antes se revelaban a 641 mientras el main
                  seguía capado en 560px hasta 1024: en una tablet las
                  columnas fijas sumaban 514px y a la del NOMBRE le
                  quedaban 14 — o sea, la tabla no decía de qué producto
                  era cada fila. Si se toca un ancho de columna o el
                  `max-w` del main, estos números se revisan juntos. */}
              {/* La marca va en la CELDA, no en el control de adentro: el
                  evento de la grilla reporta como `target` la celda, y
                  `closest` busca hacia arriba —nunca hacia adentro—, así
                  que marcando solo el switch el guard no encontraba nada y
                  cambiar la disponibilidad abría igual la ficha. */}
              <ColumnDirective
                customAttributes={{ "data-sin-abrir-ficha": "true" }}
                field="available"
                headerText="Disponible"
                hideAtMedia="(min-width: 768px)"
                template={(product: ProductRow) => (
                  <AvailabilityCell branchId={data.selectedBranchId} onChanged={() => router.refresh()} product={product} />
                )}
                textAlign="Center"
                width={148}
              />
              {data.features.stock ? (
                <ColumnDirective
                  field="stockQuantity"
                  headerText="Stock"
                  hideAtMedia="(min-width: 768px)"
                  template={(product: ProductRow) => {
                    // Tres estados, no dos: "se acabó" y "está por acabarse"
                    // piden acciones distintas —reponer ya o anotarlo para
                    // la próxima compra— y con un solo ámbar se leían igual.
                    const estado = stockStatusOf(product);
                    if (estado === null) return null;
                    const tono =
                      estado === "out"
                        ? { caja: "bg-rose-50 text-rose-700", punto: "bg-rose-500" }
                        : estado === "low"
                          ? { caja: "bg-[#FDF0D5] text-[#8A5A1E]", punto: "bg-amber-500" }
                          : { caja: "bg-slate-100 text-slate-500", punto: "bg-slate-400" };

                    return (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${tono.caja}`}>
                        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${tono.punto}`} />
                        {formatQuantity(product.stockQuantity as number, product.unit as never)}
                      </span>
                    );
                  }}
                  width={118}
                />
              ) : null}
              {/* El orden y el filtro usan `priceValue` (numérico): los
                  strings formateados no ordenan ni filtran bien. El
                  template sigue mostrando `priceLabel` para el ojo.
                  `null` = sin precio y EJ2 lo deja al final en orden
                  ascendente (ver comparador numérico de DataUtil). */}
              {/* Costo al lado del precio, no escondido en la ficha: sin
                  los dos juntos no se puede leer el margen, que es la
                  pregunta que el dueño trae. Se oculta en mobile, donde
                  solo entran Producto y Precio. */}
              <ColumnDirective
                field="cost"
                headerText="Costo"
                hideAtMedia="(min-width: 768px)"
                template={(product: ProductRow) => (
                  <span className="text-[0.9375rem] font-semibold text-slate-600">
                    {product.cost !== null ? money(product.cost) : "—"}
                  </span>
                )}
                textAlign="Right"
                type="number"
                width={120}
              />
              <ColumnDirective
                field="priceValue"
                headerText="Precio"
                template={(product: ProductRow) => (
                  <span className="text-[0.9375rem] font-bold text-slate-950">
                    {product.priceLabel}
                  </span>
                )}
                textAlign="Right"
                type="number"
                width={128}
              />
              {/* Margen calculado, no guardado: sale de costo y precio. Se
                  pinta cuando queda por debajo de 30%, que es lo que hay
                  que ver de un vistazo. "—" cuando falta alguno de los dos
                  — no se inventa un número (ver AGENTS.md). */}
              <ColumnDirective
                field="margen"
                headerText="Margen"
                hideAtMedia="(min-width: 1024px)"
                template={(product: ProductRow) => {
                  const margen = margenPct(product.cost, product.priceValue);
                  // Un costo cargado mal (222.222 con precio 5) da
                  // -4.444.340%, que desbordaba la celda y rompía la fila.
                  // Por debajo de -999% el número exacto no informa nada
                  // —ya se sabe que está mal— así que se corta y el título
                  // guarda el valor real por si alguien lo necesita.
                  const desbordado = margen !== null && margen < -999;
                  return (
                    <span
                      className={`text-[0.9375rem] font-bold ${margen !== null && margen < 30 ? "text-rose-600" : "text-slate-600"}`}
                      title={desbordado ? `${margen}%` : undefined}
                    >
                      {margen === null ? "—" : desbordado ? "< -999%" : `${margen}%`}
                    </span>
                  );
                }}
                textAlign="Right"
                // "MARGEN" pide 66px de texto y el resto de la cabecera
                // —padding, menú de columna, flecha de orden— come ~61px
                // fijos (12 de ellos son el aire lateral de `.e-lastcell`),
                // así que el piso real son 127 y por debajo el título se
                // corta en "MARG…". Todo medido en el navegador; el ancho
                // de más sale de la columna del nombre, que es `auto`.
                width={140}
              />
              {/* Acá había una columna con un botón "Editar" por fila. Se
                  fue: repetía once veces una acción que ya hace la fila
                  entera, y se comía 86px de ancho —en mobile, de los pocos
                  que hay— para decir algo que el hover y el cursor ya
                  dicen. Lo que sí aportaba, poder abrir la ficha con
                  teclado, ahora lo cubre el nombre del producto, que es un
                  botón de verdad. */}
            </ColumnsDirective>
            {/* Pie de totales. Ninguno es la suma de su columna, y es a
                propósito: sumar precios unitarios ($9.520 + $5.290 + …) da
                un número que no existe en ningún lado, y sumar existencias
                mezcla peras con kilos. Cada pie contesta la pregunta que sí
                se le hace a esa columna, sobre lo que HAY en stock. El
                detalle del cálculo está en `totalesDe`.

                El valor que calcula EJ2 no se usa —de ahí el `Count`, que
                solo sirve para que la columna tenga pie—: cada plantilla
                saca su número de `filasTotalizadas()`, porque el agregado
                de la grilla solo ve la página. */}
            <AggregatesDirective>
              <AggregateDirective>
                <AggregateColumnsDirective>
                  {/* La columna ancha lleva el rótulo: si cada número
                      arrastrara su propia leyenda, el pie sería una fila de
                      texto chico. Acá se dice una vez sobre qué se totaliza
                      y abajo los números quedan limpios y comparables. */}
                  <AggregateColumnDirective
                    field="name"
                    footerTemplate={() => {
                      const total = totalesDe(filasTotalizadas());
                      return (
                        <div className="text-left">
                          {/* "Tu mercadería hoy" y no "Totales": totales es
                              una palabra de tabla, no de negocio. Esta
                              celda arranca la frase que completan los
                              números de la derecha ("… $213.065 si la
                              reponés, $644.100 si la vendés"). */}
                          <p className="text-[0.8125rem] font-black text-slate-950">Tu mercadería hoy</p>
                          <p className="mt-0.5 text-[0.6875rem] font-semibold text-slate-500">
                            {total.conStock} {total.conStock === 1 ? "producto" : "productos"} con stock
                            {/* No se disimula: si falta un costo, el total
                                de costo queda corto y el margen sale mejor
                                de lo que es. Se dice cuántos son, y el
                                título largo explica por qué importa. */}
                            {total.sinCosto > 0 ? (
                              <span
                                className="text-amber-700"
                                title="Quedan fuera de la cuenta: sin costo cargado no se sabe cuánto valen, y contarlos como cero infla la ganancia."
                              >
                                {" "}
                                · {total.sinCosto} sin costo
                              </span>
                            ) : null}
                          </p>
                        </div>
                      );
                    }}
                    type="Count"
                  />
                  {data.features.stock ? (
                    <AggregateColumnDirective
                        field="stockQuantity"
                      footerTemplate={() => {
                        const total = totalesDe(filasTotalizadas());
                        // Cuántos hay que reponer, no cuántas unidades: las
                        // unidades no se pueden sumar entre sí (40 unidades
                        // + 2 kg no es "42 de algo") y además lo accionable
                        // es a cuántos productos hay que salir a comprar.
                        // "Nada por reponer" y no "Todo con stock": los dos
                        // estados quedan sobre el mismo eje (cuántos hay que
                        // ir a comprar), así que se comparan de un vistazo.
                        // Y no repite "stock", que ya lo dice la celda de la
                        // izquierda.
                        return total.porReponer > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF0D5] px-2 py-0.5 text-[0.6875rem] font-bold text-[#8A5A1E]">
                            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                            {total.porReponer} por reponer
                          </span>
                        ) : (
                          <span className="text-[0.6875rem] font-semibold text-slate-500">Nada por reponer</span>
                        );
                      }}
                      type="Count"
                    />
                  ) : null}
                  <AggregateColumnDirective
                    field="cost"
                    footerTemplate={() => {
                      const total = totalesDe(filasTotalizadas());
                      // `Product.cost` es el costo de REPOSICIÓN (lo último
                      // que se pagó), así que esto es lo que saldría volver
                      // a comprar lo que hay. NO es el valor del inventario:
                      // el patrimonio se valúa a promedio ponderado y sale
                      // de `StockLevel.avgCost` (ver AGENTS.md). Por eso el
                      // rótulo no dice "costo total de mercadería": eso se
                      // lee como cuánto vale el inventario, y ese número es
                      // otro.
                      //
                      // Y dice "todas las unidades" en serio, no de adorno:
                      // arriba la columna muestra el costo de UNA, así que
                      // sin decirlo el pie se puede leer como unitario. Es
                      // la duda que aparece primero.
                      return (
                        <div className="text-right">
                          <p className="text-[0.9375rem] font-black text-slate-950">{money(total.costo)}</p>
                          <p
                            className="text-[0.6875rem] font-semibold text-slate-500"
                            title="Lo que te saldría volver a comprar toda la existencia, al último costo cargado. No es la valuación del inventario: eso va a promedio ponderado."
                          >
                            reponer todas las unidades
                          </p>
                        </div>
                      );
                    }}
                    type="Count"
                  />
                  <AggregateColumnDirective
                    field="priceValue"
                    footerTemplate={() => {
                      const total = totalesDe(filasTotalizadas());
                      return (
                        <div className="text-right">
                          <p className="text-[0.9375rem] font-black text-slate-950">{money(total.precio)}</p>
                          <p
                            className="text-[0.6875rem] font-semibold text-slate-500"
                            title="Lo que entraría si vendieras toda la existencia a precio de lista. Ojo: no es la suma de la columna —esa sumaría precios unitarios—, es precio × existencia."
                          >
                            vender todas las unidades
                          </p>
                        </div>
                      );
                    }}
                    type="Count"
                  />
                  <AggregateColumnDirective
                    field="margen"
                    footerTemplate={() => {
                      const total = totalesDe(filasTotalizadas());
                      // Sale de los DOS totales de arriba, no del promedio
                      // de los márgenes de cada fila: el promedio simple le
                      // da el mismo peso a un alfajor que a 60 medialunas.
                      // El rótulo no dice "ponderado" —es jerga y el que
                      // mira esto no la usa—; que sea ponderado se nota en
                      // que el número es el correcto, no en el cartel.
                      return (
                        <div className="text-right">
                          <p
                            className={`text-[0.9375rem] font-black ${
                              total.margen !== null && total.margen < 30 ? "text-rose-600" : "text-slate-950"
                            }`}
                          >
                            {total.margen === null ? "—" : `${total.margen}%`}
                          </p>
                          <p
                            className="text-[0.6875rem] font-semibold text-slate-500"
                            title="Sale de los dos totales (1 − costo ÷ venta), no de promediar el margen de cada producto: así 60 medialunas pesan más que un alfajor."
                          >
                            de ganancia
                          </p>
                        </div>
                      );
                    }}
                    type="Count"
                  />
                </AggregateColumnsDirective>
              </AggregateDirective>
            </AggregatesDirective>
            <Inject services={[Aggregate, ColumnMenu, Reorder, Page, Sort, Filter]} />
          </GridComponent>
        </div>
    ),
    [data, categoryNameById, gridRows, pageSettings, openEdit, filasTotalizadas, router],
  );

  return (
    <PageEnter>
      {/* El colchón de abajo deja el último ítem por encima del botón «+»
          flotante (96px + 56px = tope a 152px; 11rem = 176px le da 24px de
          aire). Sin esto el «+» tapa el precio de la última fila (NEBU-42). */}
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+11rem)] pt-6 text-slate-950 md:max-w-none lg:px-8 lg:pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      <header className="flex items-center justify-between gap-4 duration-500 animate-in fade-in slide-in-from-top-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{data.businessName}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-950">{data.catalogPlural}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {/* Talles solo donde existen: en una verdulería ese botón no es
              ruido, es una invitación a cargar mal. */}
          {data.features.variants ? (
            <VariantGenerator branchId={data.selectedBranchId} categories={data.categories} />
          ) : null}
          {/* La acción principal de la pantalla, y una sola. Antes acá decía
              "Escanear", que es un CÓMO y no un QUÉ: el que entra quiere cargar
              un producto, no escanear. Ahora el botón dice lo que hace y el
              cómo se elige adentro (ver NewProductChooser). */}
          <button
            className="flex items-center gap-2 rounded-md bg-[#1d1d1f] px-4 py-2.5 text-sm font-black text-white transition active:scale-95"
            onClick={abrirAlta}
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
                  onChange={(event) => buscar(event.target.value)}
                  placeholder={`Buscar ${data.catalogPlural.toLowerCase()}…`}
                  defaultValue=""
                />
              </div>
            ) : null}

            {/* Grilla de productos con DataGrid de Syncfusion EJ2: reemplaza la
                lista custom. El buscador de arriba ya filtra en memoria (sin
                acentos, sin mayúsculas); la grilla suma orden por columna,
                filtros por columna, paginación y toolbar. Un toque en la fila
                (o en "Editar") abre la ficha. */}
            {/* Radio y padding de la tarjeta viven en `.catalog-card`
                (syncfusion-catalog.css), no en clases de Tailwind. */}
            {grilla}
          </>
        )}
      </div>

      {/* Alta de un ítem del catálogo. Dialog de Syncfusion EJ2 reemplaza al
          bottom sheet: el mismo flujo paso a paso, ahora en un modal con su
          botón de cierre propio (tooltip y aria en español por el locale es).
          El contenido scrollea dentro del diálogo (max-height en el CSS). */}
      {/* El alta entra desde la derecha, igual que la ficha: dos formas de
          cargar lo mismo no pueden aparecer de dos maneras distintas. Y el
          DialogComponent de EJ2 en esta pantalla se quedaba con la instancia en
          `visible: true` y el nodo en `e-popup-close` —abierto para el
          componente, invisible para el usuario—; esto es React puro sobre un
          portal, con trampa de foco y cierre con Escape. */}
      <SidePanel
        onClose={closeNew}
        open={newOpen}
        title={createdProduct ? "Listo" : pasoActual.title}
        width="min(30rem, calc(100vw - 1.5rem))"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 px-7 pb-4 pt-6">
          <h2 className="min-w-0 text-xl font-black tracking-tight text-slate-950">
            {createdProduct ? "Listo" : pasoActual.title}
          </h2>
          <button
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
            onClick={closeNew}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>
        {/* El contenido monta recién cuando el Dialog terminó de abrirse
            (evento `open` = fin de la animación): el RTE y el Uploader no se
            inicializan ni cerrados ni abriéndose. Al cerrar se desmonta todo,
            así cada apertura arranca con componentes frescos. */}
        {newReady ? (
          createdProduct ? (
          /* Confirmación y nada más. La foto ya se preguntó como paso del alta:
             volver a pedirla acá era hacerle el mismo trámite dos veces. */
          <div className="flex flex-col">
            <p className="truncate text-xl font-black tracking-tight text-slate-950">{createdProduct.name}</p>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4">
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
            <div className="mt-5 flex items-center gap-3">
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
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => event.preventDefault()}
            ref={newFormRef}
          >
          <input name="branchId" type="hidden" value={newBranchId} />

          {/* Scrollea el contenido, no el panel: el pie con "Seguir" queda
              siempre a mano, y el progreso del paso tampoco se va de pantalla
              al bajar —es lo que dice dónde estás parado. */}
          <div className="shrink-0 px-7 pb-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-primary">
                Paso {newStep + 1} de {pasos.length}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{pasoActual.subtitle}</p>
            </div>
            <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:w-40">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${((newStep + 1) / pasos.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Los campos de TODOS los pasos quedan montados; sólo se muestra el
              del paso actual. Así volver atrás no borra lo cargado y el submit
              final manda todo junto, sin duplicar el valor en estado. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
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
              {/* Textarea, no el editor enriquecido. La descripción se guarda y
                  se muestra como TEXTO PLANO —la carta pública y el ticket la
                  renderizan cruda—, así que una barra con deshacer y rehacer
                  ofrecía formato que después se tira. Es el mismo cambio que ya
                  hicimos en la ficha: el alta y la edición del mismo campo no
                  pueden usar controles distintos.

                  De paso se arregla el placeholder, que salía en MAYÚSCULAS
                  porque heredaba el `uppercase` de la etiqueta.

                  El texto vive en estado y viaja en el input oculto, que siempre
                  está en el form: el campo se desmonta al cambiar de paso y uno
                  desmontado no se envía. */}
              {pasoActual.id === "identidad" ? (
                <CampoDescripcion defaultValue="" name="description" />
              ) : null}
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
                <button
                  className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center transition hover:border-primary/40 hover:bg-white"
                  onClick={() => openUploaderPicker(nuevoUploaderRef)}
                  type="button"
                >
                  <Plus className="size-8 text-slate-400" />
                  <span className="text-sm font-black text-slate-600">Elegir una foto</span>
                  <span className="text-xs text-slate-500">Se guarda recién al crear. Podés saltear este paso.</span>
                </button>
              )}
              {/* El Uploader de EJ2 abre el selector y valida el tipo; vive
                  oculto porque la tarjeta de arriba es la cara visible (sin
                  lista de archivos: la vista previa la dibuja el estado). */}
              <CatalogUploader onFile={elegirFoto} uploaderRef={nuevoUploaderRef} />
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
                <div className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Categoría (opcional)</span>
                  <SyncSelect
                    ariaLabel="Categoría"
                    defaultValue=""
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

          <div className="shrink-0 border-t border-slate-100 px-7 py-4">
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
              {/* Los `key` distintos son a propósito: sin ellos React reutiliza
                  el mismo nodo para "Seguir" y para "Crear" —misma posición del
                  árbol— y el botón cambia de identidad debajo del dedo del
                  usuario en pleno click. */}
              {esUltimoPaso ? (
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:opacity-60"
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
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
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
        )
        ) : null}
      </SidePanel>

      {/* Ficha del producto: entra desde la derecha.
          Es un panel y no un diálogo centrado porque acá se viene a MIRAR y
          corregir contra la tabla —"este cuesta 3.500, ¿estará bien?"—: el
          panel deja la lista a la vista al costado, mientras que un modal
          centrado la tapa entera.

          Además reemplaza al DialogComponent de EJ2, que en esta pantalla se
          quedaba con la instancia en `visible: true` y el nodo en
          `e-popup-close`: se daba por abierto y no se veía. Este es React puro
          sobre un portal, con trampa de foco, cierre con Escape y foco devuelto
          a la fila que lo abrió. */}
      <SidePanel
        onClose={closeEdit}
        open={editing !== null}
        title={`Editar ${data.catalogSingular.toLowerCase()}`}
        // La ficha se mira en dos columnas (foto + datos). En los 30rem de
        // default cada una quedaba en ~200px y todo se partía en dos renglones,
        // que fue exactamente el problema que tenía el diálogo topado en 640px.
        width="min(44rem, calc(100vw - 1.5rem))"
      >
        {editing ? (
          <>
            <header className="flex shrink-0 items-start gap-4 px-7 pb-5 pt-6">
              {/* La foto ES el control, no una estampita al lado del título.
                  Es como el dueño reconoce el producto —confirma de un vistazo
                  que abrió el que quería— y es también donde se cambia: una
                  sola imagen en toda la ficha, en el lugar que se mira primero. */}
              <ProductPhotoField
                aiEnabled={data.aiImagesEnabled}
                catalogSlug={editing.catalogSlug}
                compact
                hasPhoto={editing.hasPhoto}
                onPendiente={(cambio) => {
                  setFotoPendiente(cambio);
                  setFotoError(null);
                  // Recontar a mano: la foto no es un campo del formulario, así
                  // que su cambio no dispara el `onChange` que lleva la cuenta.
                  const form = document.getElementById(FORM_FICHA);
                  const datos = form instanceof HTMLFormElement ? new FormData(form) : null;
                  setCambios((datos ? contarCambios(datos, editing, editConfig) : 0) + 1);
                }}
                key={editing.id}
                productDescription={editing.description}
                productId={editing.id}
                productName={editing.name}
                version={editing.imageVersion}
              />
              <div className="min-w-0 flex-1">
                {/* El nombre se EDITA acá, donde se lee. Antes estaba dos
                    veces: grande en el encabezado y otra vez como campo en el
                    formulario. Dos representaciones del mismo dato terminan
                    divergiendo apenas alguien tipea, y obligan a preguntarse
                    cuál manda.

                    Un input con pinta de título, no un título con un lápiz al
                    lado: se hace foco y se escribe. El fondo aparece al pasar
                    por encima para que se note que se puede tocar. Los modelos
                    con talles no se editan acá —el nombre sale de la familia—,
                    así que ahí va de solo lectura. */}
                {editing.familyName ? (
                  <h2 className="truncate text-2xl font-black tracking-tight text-slate-950">
                    {`${editing.familyName} ${editing.variantLabel ?? ""}`}
                  </h2>
                ) : (
                  <input
                    aria-label="Nombre del producto"
                    className="-mx-2 w-[calc(100%+1rem)] rounded-xl border border-transparent bg-transparent px-2 py-0.5 text-2xl font-black tracking-tight text-slate-950 outline-none transition hover:bg-slate-50 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
                    defaultValue={editing.name}
                    form={FORM_FICHA}
                    name="name"
                    required
                    type="text"
                  />
                )}
                {/* Categoría · unidad · código, en una línea: son los datos que
                    identifican al producto, no los que se editan. */}
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {[
                    categoryNameById.get(editing.categoryId ?? "") ?? "Sin categoría",
                    unitLabel(editing.unit as never),
                    editing.sku ?? editing.barcode ?? null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {/* Tres estados y no dos: "sin configurar" no es lo mismo que
                    "no disponible" —uno nunca se tocó, el otro se apagó a
                    propósito— y el color solo no los distingue. */}
                {/* El estado ES el control que lo cambia, no un cartel que lo
                    describe. Antes el encabezado decía "Disponible" y abajo del
                    todo había un switch que decía lo mismo: para prender o
                    apagar un producto había que scrollear hasta el fondo
                    buscando el interruptor de algo que ya estabas mirando. */}
                <div className="mt-2 flex items-center gap-2">
                  <AvailabilityToggle
                    defaultOn={editConfig?.available || !editConfig?.configured}
                    form={FORM_FICHA}
                    key={editBranchId}
                  />
                  <span className="text-sm font-bold text-slate-600">Disponible para vender</span>
                  {/* "Sin configurar" no es lo mismo que "no disponible": uno
                      nunca se tocó, el otro se apagó a propósito. */}
                  {!editConfig?.configured ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                      Sin configurar
                    </span>
                  ) : null}
                </div>
              </div>
              {/* El nombre del producto ES el título, así que el botón no lo
                  repite: solo cierra. */}
              <button
                aria-label="Cerrar"
                className="-mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
                onClick={closeEdit}
                type="button"
              >
                <X className="size-5" />
              </button>
            </header>
            {/* El encabezado sale enseguida (el panel no arranca vacío) pero el
                form espera a `editReady`: el RichTextEditor y el Uploader de
                EJ2 no se inicializan bien montados en plena animación de
                apertura (NEBU-48). A los 250ms el panel todavía está entrando
                —la animación dura 440—, así que el form ya está antes de que
                termine de aterrizar. */}
            {editReady ? (
          <form
            // La foto va primero y el resto después, en el mismo envío.
            //
            // Primero porque son dos llamadas distintas —la imagen viaja aparte,
            // no como campo del formulario— y si fallara la de la foto no tiene
            // sentido haber guardado ya el precio: se corta antes y el usuario
            // ve el error con su formulario intacto para reintentar.
            action={async (formData: FormData) => {
              if (fotoPendiente) {
                const resultado = fotoPendiente.quitar
                  ? await deleteProductImage(editing.id)
                  : await subirFoto(editing.id, fotoPendiente.archivo);

                if (!resultado.ok) {
                  setFotoError(resultado.error);
                  return;
                }

                setFotoPendiente(null);
                setFotoError(null);
              }

              await updateProduct(formData);
            }}
            // El padding va ACÁ y no en `.e-dlg-content` por CSS: EJ2 deja este
            // form como hijo directo del diálogo, no adentro del contenedor de
            // contenido, así que el padding de esa clase no lo alcanzaba y todo
            // arrancaba pegado al borde. El valor coincide con el del header
            // (28px) para que el título y el contenido arranquen en la misma
            // vertical; si no coinciden se ve como un escalón.
            className="flex min-h-0 flex-1 flex-col"
            id={FORM_FICHA}
            key={editing.id}
            // Se recalcula 150ms DESPUÉS de la última tecla, no en cada una.
            //
            // Cada recálculo arma un FormData con el formulario entero —están
            // montados los campos de todas las pestañas, no solo los visibles—,
            // compara ocho campos y dispara un re-render que arrastra a la
            // grilla de EJ2 con todas sus plantillas. Hacer eso por carácter es
            // lo que se sentía como tipeo trabado.
            //
            // Nada de lo que se recalcula es urgente: el margen, la ganancia y
            // el contador de cambios son resultados, no la letra que se está
            // escribiendo. El input responde solo, sin pasar por React.
            onChange={() => programarRecalculo()}
          >
            <input name="branchId" type="hidden" value={editBranchId} />
            <input name="productId" type="hidden" value={editing.id} />
            <input name="configured" type="hidden" value={editConfig?.configured ? "true" : "false"} />

            {/* Dos pestañas. La ficha mezclaba lo que se mira todos los días
                —nombre, precio, foto— con lo que se configura una vez —códigos,
                costo, mínimos, bultos— y para llegar a lo segundo había que
                scrollear pasando por lo primero.

                Se ocultan con CSS y NO se desmontan: es un solo <form>, y un
                campo desmontado no se envía. Cambiar de pestaña borraría en
                silencio lo que el usuario escribió del otro lado. */}
            <div className="flex shrink-0 gap-2 border-b border-slate-100 px-7 pb-2">
              {(
                [
                  // Ninguna se llama como el todo: la ficha del producto es el
                  // modal entero, así que usar "Producto" para una solapa de
                  // adentro decía que las otras dos no son parte de la ficha.
                  { key: "producto", label: "General" },
                  { key: "stock", label: data.features.stock ? "Inventario" : "Códigos" },
                  { key: "analisis", label: "Rentabilidad" },
                  { key: "historial", label: "Historial" },
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

            {/* Lo que scrollea es ESTO: ni el form entero ni las pestañas.
                El pie queda afuera —pegado adentro del área que se mueve, el
                contenido le pasaba por atrás y el fondo translúcido cortaba
                texto a mitad de renglón— y las pestañas también, porque irse de
                pantalla al bajar deja sin saber en cuál estás parado. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6 pt-4">
            {/* El `hidden` NO se combina con las clases del layout: `sm:grid`
                vive en una media query y le gana a `hidden`, así que el panel
                se seguía viendo en escritorio y las dos pestañas aparecían
                juntas. Oculto significa oculto y nada más. */}
            {/* Dos columnas con un reparto explícito, no un grid que va
                acomodando en orden de lectura: así la foto caía al lado del
                nombre por casualidad y abajo a la derecha quedaba un hueco.
                Izquierda la identidad —cómo se ve y si se vende—, derecha los
                datos que se escriben. */}
            {/* Una sola columna, en orden de uso: primero el precio —que es a
                lo que se entra el 90% de las veces—, después lo que casi nunca
                se toca. Las dos columnas de antes partían por "identidad /
                decisiones", que es una taxonomía de programador: el dueño ya
                sabe qué producto abrió, lo está viendo arriba. */}
            <div className={editTab === "producto" ? "grid gap-5" : "hidden"}>
              <div className="space-y-4">
                {!editConfig?.configured ? (
                  <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                    <CircleSlash className="size-4 shrink-0" />
                    Sin precio{editBranchName ? ` en ${editBranchName}` : " en esta sucursal"} — cargalo para poder venderlo.
                  </p>
                ) : null}

                {/* Precio y costo JUNTOS, con el margen debajo. Separados —el
                    costo vivía en la otra pestaña— se fijaba precio a ciegas:
                    para saber si un número deja ganancia hay que ver contra
                    qué. El margen se recalcula al tipear. */}
                {/* Los dos adentro de una tarjeta con título: precio y costo no
                    son dos campos sueltos, son las dos mitades de la misma
                    decisión. Encerrados se leen como un bloque, y la ganancia
                    de abajo queda claramente colgando de ellos. */}
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="mb-3 text-sm font-black text-slate-950">Precio y costos</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                  {/* "Precio", no "PRECIO EN PASTERLERIA BAKERT": en mayúsculas
                      esa frase se partía en dos renglones y desalineaba la
                      fila. La sucursal baja a un renglón de ayuda, en minúscula
                      y solo cuando hay más de una. */}
                  <label className="grid min-w-0 gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    Precio
                    <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                      <span className="text-lg font-black text-slate-600">$</span>
                      <MoneyInput
                        className="w-full min-w-0 bg-transparent px-2 py-3.5 text-lg font-black text-slate-950 outline-none"
                        defaultValue={editConfig?.priceValue ?? ""}
                        key={editBranchId}
                        name="price"
                        placeholder="0"
                      />
                    </div>
                  </label>

                  <label className="grid min-w-0 gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    Costo
                    <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/15">
                      <span className="text-lg font-black text-slate-600">$</span>
                      <MoneyInput
                        className="w-full min-w-0 bg-transparent px-2 py-3.5 text-lg font-black text-slate-950 outline-none"
                        defaultValue={editing.cost ?? ""}
                        name="cost"
                        placeholder="—"
                      />
                    </div>
                  </label>
                  </div>
                </div>

                {/* El margen no se edita —sale de precio y costo— así que va
                    como badge y no como tercer campo: la forma ya avisa que es
                    un resultado. "—" cuando falta alguno: no se inventa un
                    número (ver AGENTS.md). */}
                {/* Ganancia y margen, los dos. Son preguntas distintas: los
                    pesos dicen cuánto deja cada venta, el porcentaje si el
                    precio está bien puesto. Con 63% sobre $630 y 63% sobre
                    $9.520 se toman decisiones muy distintas, y el porcentaje
                    solo no las separa.

                    No se editan —salen de precio y costo—, así que van como
                    tarjetas de resultado y no como campos. "—" cuando falta
                    alguno de los dos: no se inventa un número (AGENTS.md). */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-950/5">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Ganancia</p>
                    <p
                      className={`mt-0.5 text-xl font-black ${
                        gananciaViva === null ? "text-slate-400" : gananciaViva < 0 ? "text-rose-600" : "text-emerald-700"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {gananciaViva === null ? "—" : `${gananciaViva > 0 ? "+" : ""}${money(gananciaViva)}`}
                    </p>
                    <p className="text-[0.6875rem] text-slate-500">por unidad</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-950/5">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">Margen</p>
                    <p
                      className={`mt-0.5 text-xl font-black ${
                        margenVivo === null ? "text-slate-400" : margenVivo < 30 ? "text-rose-600" : "text-emerald-700"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {margenVivo === null ? "—" : `${margenVivo}%`}
                    </p>
                    <p className="text-[0.6875rem] text-slate-500">
                      {margenVivo === null ? "cargá costo y precio" : "sobre el precio"}
                    </p>
                  </div>
                </div>
                {data.branches.length > 1 && editBranchName ? (
                  <p className="text-xs text-slate-500">El precio es de {editBranchName}.</p>
                ) : null}

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

                {/* Textarea pelado, no el editor enriquecido.
                    La descripción se guarda y se muestra como TEXTO PLANO —la
                    carta pública y el ticket la renderizan cruda—, así que una
                    barra con negrita, tablas y deshacer ofrecía formato que
                    después se tira. Un control tiene que poder hacer lo que
                    aparenta. El contador avisa el límite antes de chocarlo, no
                    después. */}
                <CampoDescripcion defaultValue={editing.description ?? ""} name="description" />

                {/* Lo que casi nunca se toca, al final y en una fila: categoría
                    y código no son la razón por la que se abre una ficha. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
                    Categoría
                    <SyncSelect
                      ariaLabel="Categoría"
                      defaultValue={editing.categoryId ?? ""}
                      key={editing.id}
                      name="categoryId"
                      options={[
                        { value: "", label: "Sin categoría" },
                        ...data.categories.map((category) => ({ value: category.id, label: category.name })),
                      ]}
                    />
                  </label>
                  <label className="grid gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
                    Código interno
                    <input
                      className={sheetInput}
                      defaultValue={editing.sku ?? ""}
                      name="sku"
                      placeholder="—"
                      type="text"
                    />
                  </label>
                </div>

                {data.branches.length > 1 ? (
                  <BranchSelect branches={data.branches} onChange={setEditBranchId} value={editBranchId} />
                ) : null}
              </div>

            </div>

            {/* Pestaña de stock y códigos. */}
            <div className={editTab === "stock" ? "space-y-4" : "hidden"}>
              {/* Los tres números de un vistazo antes de cualquier control:
                  cuánto hay, cuándo reponer y a cuánto volver. Puestos juntos
                  se leen como una frase —"tengo 24, aviso en 10, quiero 30"—
                  que por separado hay que ir a buscar a tres lugares. */}
              {data.features.stock ? (
                <NivelDeInventarioPanel
                  actual={editing.stockQuantity}
                  campos={{ ideal: "idealStock", minimo: "minStock" }}
                  ideal={editing.idealStockRaw}
                  minimo={editing.minStockRaw}
                  unidad={editing.unit as never}
                />
              ) : null}

              {/* La existencia y sus operaciones: es lo que se viene a hacer
                  acá, y lo de abajo se configura una vez. */}
              {data.features.stock ? (
                <ProductStockPanel
                  branchId={data.selectedBranchId}
                  branchName={data.selectedBranchName}
                  minStock={editing.minStockRaw}
                  onChanged={() => setEditStockChanged(true)}
                  productId={editing.id}
                  quantity={editing.stockQuantity}
                  // Sin resumen: "Stock actual 19" ya está en la tarjeta de
                  // arriba. Repetir el mismo número dos veces seguidas hace
                  // dudar de si son dos cosas distintas.
                  showSummary={false}
                  unit={editing.unit as never}
                />
              ) : null}

              {/* Después del ajuste y antes de la configuración: contesta la
                  pregunta que aparece justo ahí —"¿de dónde salieron estas 24?"—
                  y evita ajustar a ciegas sobre un número que no se entiende. */}
              {data.features.stock ? (
                <ProductMovements
                  activa={editTab === "stock"}
                  branchId={data.selectedBranchId}
                  key={`${editing.id}-${data.selectedBranchId}`}
                  productId={editing.id}
                  unidad={editing.unit as never}
                />
              ) : null}

              {/* De acá para abajo, lo que se define una vez en la vida del
                  producto. Va al final y con su título: antes la configuración
                  estaba partida en dos —unos campos arriba, otros abajo del
                  historial— y el tab se leía como una bolsa. Ahora es
                  estado → acción → qué pasó → cómo está configurado. */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-slate-500">
                  Configuración del producto
                </p>
              </div>

              <input name="hasCommercialFields" type="hidden" value="true" />
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                  <label className="grid min-w-0 gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
                    Tipo
                    {/* De acá sale si lleva stock: un servicio no tiene
                        existencias y un producto físico sí. Antes había además
                        un tilde "Controlar stock" que decía lo mismo y permitía
                        guardar la contradicción. */}
                    <SyncSelect
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
                    <SyncSelect
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
                  {/* SKU y categoría se editan en General, no acá. Estaban en
                      los dos lados: como es UN solo <form>, dos inputs con el
                      mismo `name` hacen que `FormData` se quede con el primero
                      y el segundo no guarde nada — se tipea y se pierde sin
                      aviso. Acá quedan los códigos y los mínimos, que sí son
                      de inventario. */}
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
            {editTab === "historial" ? (
              <ProductHistory activa={editTab === "historial"} key={editing.id} productId={editing.id} />
            ) : null}

            {editTab === "analisis" ? (
              <ProductAnalyticsTab
                activa
                productId={editing.id}
                unidad={editing.unit as never}
                usaStock={data.features.stock}
              />
            ) : null}
            </div>

            {/* El pie vive AFUERA del scroll: siempre visible, sin taparle nada
                al contenido.

                Y solo en las pestañas donde hay algo que guardar. Rentabilidad
                e Historial son de lectura: un botón "Guardar cambios" ahí
                promete una acción que no existe, y peor, invita a apretarlo
                pensando que se está guardando lo que se está mirando.

                A la izquierda, cuántos campos cambiaron. Decir el número y no
                un "hay cambios" es lo que deja cerrar sin miedo. Cuando no hay
                nada tocado el aviso no aparece: un cartel permanente deja de
                leerse. */}
            {editTab === "producto" || editTab === "stock" ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-white px-7 py-4">
              <p className="min-w-0 text-sm font-bold text-slate-500">
                {fotoError ? <span className="text-rose-600">{fotoError}</span> : null}
                {!fotoError && cambios > 0 ? (
                  <span className="inline-flex items-center gap-2 text-primary">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                    {cambios} {cambios === 1 ? "cambio sin guardar" : "cambios sin guardar"}
                  </span>
                ) : null}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <BotonesDelPie
                  onCancelar={closeEdit}
                  texto={editConfig?.configured ? "Guardar cambios" : "Habilitar en esta sucursal"}
                />
              </div>
            </div>
            ) : null}
          </form>
            ) : null}
          </>
        ) : null}
      </SidePanel>

      {/* El «+» flotante entra por la misma puerta que el botón del header: si
          uno preguntara el cómo y el otro fuera derecho al formulario, la misma
          acción tendría dos comportamientos según de dónde se toque. */}
      <button
        aria-label={`Nuevo ${data.catalogSingular.toLowerCase()}`}
        className="fixed bottom-[96px] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        onClick={abrirAlta}
        type="button"
      >
        <Plus className="size-6" />
      </button>

      {data.features.barcodes ? (
        <>
          <NewProductChooser
            onClose={() => setElegirAlta(false)}
            onManual={elegirManual}
            onScan={elegirEscaner}
            open={elegirAlta}
            singular={data.catalogSingular.toLowerCase()}
          />
          {/* Sin botón propio: acá solo vive la maquinaria del escaneo (cámara,
              búsqueda del código en la base pública, alta guiada). Quien la
              abre es el selector de arriba. */}
          <CatalogScanButton
            branchId={data.selectedBranchId}
            categories={data.categories}
            onScanningChange={setEscaneando}
            scanning={escaneando}
            units={data.units}
          />
        </>
      ) : null}
    </main>
    </PageEnter>
  );
}

// Estado skeleton de ProductsManager (catálogo): mismo shell, header con
// botones, chips de sucursal, buscador y filas de producto que el componente
// real — con bloques placeholder en las posiciones de los datos.
export function ProductsManagerSkeleton() {
  return (
    <main className="mx-auto min-h-dvh w-full min-w-0 max-w-[560px] overflow-x-clip bg-[var(--background)] px-4 pb-[calc(env(safe-area-inset-bottom)+11rem)] pt-6 text-slate-950 md:max-w-none lg:px-8 lg:pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-7 w-36" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </header>

      {/* Chips de sucursal */}
      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["w-28", "w-24", "w-20"].map((width, index) => (
          <Skeleton className={`h-9 shrink-0 rounded-full ${width}`} key={index} />
        ))}
      </div>

      {/* Buscador */}
      <div className="relative mt-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>

      {/* Filas de producto */}
      <div className="mt-4 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-950/5" key={index}>
            <Skeleton className="size-11 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-1/3 max-w-36" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-2/3 max-w-52" />
            </div>
            <Skeleton className="h-5 w-14 shrink-0" />
          </div>
        ))}
      </div>

      <Skeleton className="fixed bottom-[96px] right-4 z-40 size-14 rounded-full md:bottom-8 md:right-8" />
    </main>
  );
}
