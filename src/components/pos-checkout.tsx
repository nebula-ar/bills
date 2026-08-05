"use client";

import { previewSale, submitSale, type SubmitSaleInput } from "@/app/sales/new/actions";
import type { PaymentMethod, Unit } from "@/generated/prisma/client";
import { TaxCondition } from "@/generated/prisma/enums";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanConfirmSheet, type ScannedProduct } from "@/components/scan-confirm-sheet";
import { findProductToSell } from "@/app/sales/new/scan-actions";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TAX_CONDITION_LABELS } from "@/lib/invoice-labels";
import { formatAmountInput } from "@/lib/money";
import { allowsFraction, formatQuantity, lineTotal, ONE, parseQuantityInput, unitShort } from "@/lib/quantity";
import { changeFor, coversTotal, quickCashAmounts } from "@/modules/sales/change.logic";
import { validateTaxId } from "@/lib/tax-id";
import { productImageSrc } from "@/modules/catalog/product-image-src.logic";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  ShoppingBag,
  Smartphone,
  Split,
  Store,
  Trash2,
  Wallet,
  X,
  DynamicIcon,
} from "@/components/icons";
import { useEffect, useMemo, useState, useTransition, type ComponentType } from "react";

export type PosProduct = {
  productId: string;
  name: string;
  price: number;
  unit: Unit;
  sku: string | null;
  barcode: string | null;
  // Existencia actual en la sucursal (milésimas). null = no lleva stock.
  stock: number | null;
  // Marca de tiempo de la foto (null = sin foto). Va en la URL para el caché.
  imageVersion: number | null;
  // Producto del catálogo del rubro: si no hay foto propia, se usa la genérica.
  catalogSlug: string | null;
  // Venta por bulto: cuántas unidades trae la caja y cómo se llama.
  packSize: number | null;
  packLabel: string | null;
  // Familia (modelo con talles/colores). null = producto suelto.
  familyId: string | null;
  familyName: string | null;
  variantLabel: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

export type PosBranch = {
  id: string;
  name: string;
  staffs: { id: string; name: string }[];
  products: PosProduct[];
};

export type PosCustomer = { id: string; name: string; balance: number; creditLimit: number | null };

export type PosPaymentOption = { value: string; label: string };

type PosCheckoutProps = {
  branches: PosBranch[];
  paymentOptions: PosPaymentOption[];
  initialBranchId?: string;
  // Clientes para cobrar en cuenta corriente. Vacío = módulo apagado.
  customers?: PosCustomer[];
  // Cómo llama este rubro a lo que vende ("Servicio" / "Producto").
  catalogSingular?: string;
  catalogPlural?: string;
  // Iconos del rubro: una barbería se reconoce en unas tijeras, un kiosco no.
  staffIcon?: string;
  catalogIcon?: string;
  // Qué herramientas le sirven a este rubro (ver src/lib/vertical.ts): sin
  // códigos de barras no mostramos el lector, y sin bultos no mostramos "+caja".
  features?: { barcodes: boolean; packs: boolean };
  // Cuántas ventas tuvo cada producto en los últimos 30 días. Ordena la grilla:
  // el que atiende busca casi siempre lo mismo, y tenerlo alfabético lo obliga a
  // scrollear cada vez.
  salesRank?: Record<string, number>;
  // Con qué empleado vende el que está logueado. El dueño de un comercio chico
  // es dos filas (ver registerBusiness): entra como OWNER y vende como su
  // gemelo STAFF. null = no tiene gemelo, así que hay que preguntar.
  sellsAsStaffId?: string | null;
  // Turno que se está cobrando: precarga el pedido y queda enlazado a la venta.
  appointment?: { id: string; staffId: string | null; customerId: string | null; productId: string | null } | null;
  // Presupuesto que se está cobrando: precarga el pedido completo y, al cobrar,
  // queda marcado como convertido.
  quote?: { id: string; customerId: string | null; items: { productId: string; quantity: number }[] } | null;
};

type SplitRow = { id: number; method: string; amount: string };

const paymentIcons: Record<string, ComponentType<{ className?: string }>> = {
  CASH: Banknote,
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  QR: QrCode,
  MERCADO_PAGO: Smartphone,
  ACCOUNT: ReceiptText,
  OTHER: Wallet,
};

const ACCOUNT_METHOD = "ACCOUNT";

// Dónde se recuerda quién cobró la última vez en este teléfono.
const STAFF_MEMORY_KEY = "bills:ultimo-vendedor";

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

// Acá el producto se llama `productId`, no `id`.
function posImageSrc(product: Pick<PosProduct, "productId" | "imageVersion" | "catalogSlug">) {
  return productImageSrc({ id: product.productId, imageVersion: product.imageVersion, catalogSlug: product.catalogSlug });
}

// A quién le queda atribuida la venta al abrir el mostrador en esta sucursal.
// El gemelo del que está logueado manda, pero solo si trabaja acá: en otra
// sucursal ese empleado no existe y elegirlo sería atribuir una venta imposible.
function initialStaffId(branch: PosBranch | undefined, sellsAsStaffId: string | null) {
  if (!branch) return "";
  if (sellsAsStaffId && branch.staffs.some((staff) => staff.id === sellsAsStaffId)) return sellsAsStaffId;
  return branch.staffs.length === 1 ? branch.staffs[0].id : "";
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PosCheckout({
  branches,
  paymentOptions,
  initialBranchId,
  customers = [],
  catalogSingular = "producto",
  catalogPlural = "productos",
  staffIcon = "solar:users-group-rounded-bold",
  catalogIcon = "solar:box-bold",
  appointment = null,
  quote = null,
  sellsAsStaffId = null,
  features = { barcodes: true, packs: true },
  salesRank = {},
}: PosCheckoutProps) {
  const [branchId, setBranchId] = useState(
    initialBranchId && branches.some((item) => item.id === initialBranchId) ? initialBranchId : branches[0]?.id ?? "",
  );
  const branch = branches.find((item) => item.id === branchId) ?? branches[0];
  // Quién atiende NO se preselecciona con el primero de la lista: de ahí salen
  // las comisiones, y atribuirle ventas ajenas a alguien en silencio es plata
  // mal repartida. Pero tampoco se pregunta en cada venta: se recuerda al
  // último que cobró en este teléfono, que es el que va a seguir cobrando toda
  // la tarde. Con un solo empleado no hay nada que elegir.
  //
  // El orden es: el turno que se está cobrando (ahí ya está dicho quién
  // atiende), después el gemelo del que está logueado —si el dueño atiende, la
  // venta es suya y no hay nada que suponer—, y recién después la regla del
  // único empleado. Lo recordado en el teléfono va último y NO pisa nada de lo
  // anterior: es una conjetura, y las tres de arriba son datos.
  const [staffId, setStaffId] = useState(
    appointment?.staffId ?? initialStaffId(branch, sellsAsStaffId),
  );

  // Se lee después del primer render: `localStorage` no existe en el servidor.
  useEffect(() => {
    // El `staffId` de arriba corta acá: si ya quedó resuelto (turno, gemelo o
    // único empleado) lo recordado no se toca.
    if (staffId || !branch || branch.staffs.length <= 1) return;

    const remembered = window.localStorage.getItem(`${STAFF_MEMORY_KEY}:${branch.id}`);

    // Solo si sigue trabajando en esta sucursal.
    if (remembered && branch.staffs.some((staff) => staff.id === remembered)) {
      // El setState acá es a propósito: `localStorage` no existe en el
      // servidor, así que leerlo en el render rompería la hidratación. Es el
      // único momento en que se puede.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStaffId(remembered);
    }
    // Solo al abrir el mostrador o al cambiar de sucursal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id]);

  function chooseStaff(id: string) {
    setStaffId(id);
    if (branch) {
      window.localStorage.setItem(`${STAFF_MEMORY_KEY}:${branch.id}`, id);
    }
  }
  // El carrito guarda MILÉSIMAS de unidad, igual que la base: así una verdulería
  // puede cargar 1,250 kg sin que el total se vaya por redondeo.
  const [cart, setCart] = useState<Record<string, number>>(
    // Cobrando un turno, el servicio ya está en el pedido: el barbero no tiene
    // que volver a buscarlo con el cliente enfrente.
    // Cobrando un presupuesto, entra el pedido entero tal como se cotizó.
    quote
      ? Object.fromEntries(quote.items.map((item) => [item.productId, item.quantity]))
      : appointment?.productId
        ? { [appointment.productId]: ONE }
        : {},
  );
  const [customerId, setCustomerId] = useState(quote?.customerId ?? appointment?.customerId ?? "");
  const [search, setSearch] = useState("");
  // Modelo abierto en el selector de talles.
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // Lo último escaneado, esperando confirmación. Mientras hay algo acá, el
  // lector no sigue leyendo: primero se resuelve lo que ya está en pantalla.
  const [scanned, setScanned] = useState<ScannedProduct | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // Lo último que entró por el lector. Se resalta en el panel: con la caja
  // enfrente, "¿lo tomó?" se contesta mirando, no revisando el total.
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [singleMethod, setSingleMethod] = useState(paymentOptions[0]?.value ?? "");
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  // Con cuánto paga el cliente, para calcular el vuelto. Vacío = pagó justo.
  const [cashReceived, setCashReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerTaxId, setCustomerTaxId] = useState("");
  const [customerTaxCondition, setCustomerTaxCondition] = useState<TaxCondition>(TaxCondition.CONSUMIDOR_FINAL);

  const customerTaxIdCheck = useMemo(
    () => (customerTaxId.trim().length > 0 ? validateTaxId(customerTaxId) : null),
    [customerTaxId],
  );
  const customerTaxIdHasError = customerTaxIdCheck !== null && !customerTaxIdCheck.valid;

  // Productos que llegaron por el lector y no estaban en la lista con la que se
  // abrió la pantalla (se cargaron después, o desde otra pantalla). Se suman
  // acá para que el carrito, el total y la grilla los traten como a cualquier
  // otro.
  const [extraProducts, setExtraProducts] = useState<PosProduct[]>([]);

  const products = useMemo(
    () => [...(branch?.products ?? []), ...extraProducts.filter((extra) => !(branch?.products ?? []).some((p) => p.productId === extra.productId))],
    [branch, extraProducts],
  );
  // Busca por nombre, SKU y código de barras: con un lector, escanear escribe el
  // código en este mismo campo y el producto queda filtrado solo.
  // Categoría elegida en los chips. null = todas.
  const [categoria, setCategoria] = useState<string | null>(null);

  // Las categorías que existen de verdad, en el orden en que vienen. Con pocas
  // no se muestran: dos chips para diez productos son ruido.
  const categorias = useMemo(() => {
    const vistas = new Map<string, string | null>();
    for (const p of products) {
      if (p.categoryName && !vistas.has(p.categoryName)) vistas.set(p.categoryName, p.categoryColor);
    }
    return [...vistas].map(([nombre, color]) => ({ nombre, color }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    // El chip filtra ANTES que el buscador: buscar dentro de una categoría es
    // lo que uno espera, y buscar en todo estando parado en una es confuso.
    const list = categoria ? products.filter((p) => p.categoryName === categoria) : products;
    // Sin acentos y sin mayúsculas: quien busca "banana" tiene que encontrar
    // "Banana", y quien escribe "cafe" tiene que encontrar "Café". Escribir mal
    // el término es de los problemas más documentados en este tipo de usuario.
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

    const query = normalize(search.trim());

    if (!query) {
      // Lo más vendido primero; a igualdad, alfabético. Sin ventas todavía
      // (negocio nuevo) queda el orden alfabético de siempre.
      return [...list].sort(
        (a, b) => (salesRank[b.productId] ?? 0) - (salesRank[a.productId] ?? 0) || a.name.localeCompare(b.name, "es"),
      );
    }

    return list.filter((product) =>
      [product.name, product.sku ?? "", product.barcode ?? "", product.familyName ?? ""].some((field) =>
        normalize(field).includes(query),
      ),
    );
  }, [products, search, salesRank, categoria]);

  // Con fotos, la grilla tiene que quedar pareja: si al menos un producto tiene,
  // todas las tarjetas reservan el cuadrado. Si ninguno tiene, no se reserva
  // nada y la grilla sigue tan compacta como antes.
  const showsPhotos = products.some((product) => posImageSrc(product) !== null);

  // Lo que se pinta en la grilla: los productos sueltos tal cual, y cada familia
  // una sola vez. Escanear sigue yendo al producto exacto (el código es del talle).
  type GridEntry = { kind: "product" | "family"; product: PosProduct; variants: PosProduct[] };

  const gridEntries = useMemo<GridEntry[]>(() => {
    const seenFamilies = new Set<string>();

    return filteredProducts.flatMap<GridEntry>((product) => {
      if (!product.familyId) {
        return [{ kind: "product", product, variants: [] }];
      }

      if (seenFamilies.has(product.familyId)) {
        return [];
      }

      seenFamilies.add(product.familyId);
      const variants = filteredProducts.filter((candidate) => candidate.familyId === product.familyId);

      return [{ kind: "family", product, variants }];
    });
  }, [filteredProducts]);

  const familyVariants = openFamily ? products.filter((product) => product.familyId === openFamily) : [];

  const cartItems = products
    .filter((product) => cart[product.productId])
    .map((product) => ({ ...product, quantity: cart[product.productId] }));
  // Total a precio de lista. El definitivo (con promociones) lo calcula el
  // servidor y llega en `preview`.
  const listTotal = cartItems.reduce((sum, item) => sum + lineTotal(item.price, item.quantity), 0);
  // Cuántos renglones tiene el pedido (no unidades: 1,5 kg es un renglón).
  const itemCount = cartItems.length;
  const hasItems = cartItems.length > 0;
  const selectedStaff = branch?.staffs.find((staff) => staff.id === staffId);

  // Vista previa del servidor: aplica las promos vigentes para que el vendedor
  // vea el mismo número que se va a cobrar, antes de cobrarlo.
  type Preview = {
    // Carrito al que corresponde este cálculo. Si no coincide con el actual, el
    // resultado está viejo y no se muestra (mejor el precio de lista que un
    // total que ya no aplica).
    key: string;
    subtotal: number;
    discountTotal: number;
    total: number;
    discounts: { description: string; amount: number }[];
  };

  const [preview, setPreview] = useState<Preview | null>(null);
  const cartKey = JSON.stringify(cartItems.map((item) => [item.productId, item.quantity]));

  useEffect(() => {
    if (!branch || !hasItems) {
      return;
    }

    let cancelled = false;

    // Pequeño retardo: mientras el vendedor toca +/- no vale la pena ir y volver.
    const timer = window.setTimeout(async () => {
      const result = await previewSale({
        branchId: branch.id,
        items: cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });

      if (!cancelled) {
        setPreview({ key: cartKey, ...result });
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `cartKey` resume el contenido del carrito; cartItems se recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id, cartKey, hasItems]);

  const livePreview = hasItems && preview?.key === cartKey ? preview : null;
  const total = livePreview?.total ?? listTotal;
  const discountTotal = livePreview?.discountTotal ?? 0;

  const splitAssigned = splitRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const splitRemaining = total - splitAssigned;
  const splitValid = splitMode ? splitAssigned === total && splitRows.every((row) => Number(row.amount) > 0) : true;

  // Cobrar en cuenta corriente exige elegir a quién se le fía.
  const usesAccount = splitMode
    ? splitRows.some((row) => row.method === ACCOUNT_METHOD)
    : singleMethod === ACCOUNT_METHOD;
  const accountReady = !usesAccount || Boolean(customerId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  const canConfirm =
    Boolean(branch) &&
    Boolean(staffId) &&
    hasItems &&
    splitValid &&
    accountReady &&
    total > 0 &&
    !(wantsInvoice && customerTaxIdHasError);

  const branchStep = branches.length > 1 ? 1 : 0;
  // Preguntar "¿quién atiende?" cuando hay UNA sola opción es un toque de más
  // antes de cobrar, y la respuesta ya la sabemos. Mismo criterio que la
  // sucursal acá arriba: el paso aparece solo si hay algo que elegir.
  const preguntarStaff = branch.staffs.length > 1;
  const staffStep = preguntarStaff ? branchStep + 1 : branchStep;
  const productStep = staffStep + 1;

  function selectBranch(nextId: string) {
    const nextBranch = branches.find((item) => item.id === nextId);
    setBranchId(nextId);
    setStaffId(initialStaffId(nextBranch, sellsAsStaffId));
    setCart({});
    setError(null);
  }

  function addProduct(productId: string) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + ONE }));
  }

  // Bulto entero. El mayorista que vende cajas de 24 no puede tocar "+" 24
  // veces con el camión esperando.
  function addPack(productId: string, packSize: number) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + packSize * ONE }));
  }

  function decreaseProduct(productId: string) {
    setCart((current) => {
      const quantity = current[productId] ?? 0;
      if (quantity <= ONE) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity - ONE };
    });
  }

  // Escaneo en venta: el catálogo de la sucursal ya está en memoria, así que
  // resolver el código es instantáneo y no hay que ir al servidor con la cámara
  // abierta. Suma 1 y sigue leyendo, para pasar productos uno atrás de otro.
  //
  // Lo escaneado entra derecho al pedido y se ve en el panel de abajo, con su
  // cantidad y el total: ahí se corrige un envase de más sin cortar el ritmo.
  // La confirmación en pantalla queda solo para lo que se vende por peso o por
  // metro, donde no hay cantidad que suponer: sale de la balanza.
  function avisar(tone: "ok" | "warn", text: string, ms = 2600) {
    setScanFeedback({ tone, text });
    window.setTimeout(() => setScanFeedback(null), ms);
  }

  // Suma al pedido lo que llegó por el lector y lo deja marcado en el panel.
  function pushScanned(product: ScannedProduct, quantity: number) {
    setCart((current) => ({ ...current, [product.productId]: (current[product.productId] ?? 0) + quantity }));
    setLastAddedId(product.productId);
    avisar("ok", `${product.name} · ${formatQuantity(quantity, product.unit)}`, 1800);
  }

  // Por peso o por metro se pregunta; por unidad, uno.
  function takeScanned(product: ScannedProduct) {
    if (allowsFraction(product.unit)) {
      setScanned(product);
      return;
    }

    pushScanned(product, ONE);
  }

  async function handleScan(code: string) {
    // Con la confirmación abierta el lector sigue disparando: se ignora hasta
    // que la persona resuelva lo que tiene en pantalla.
    if (scanned) return;

    const match = products.find((product) => product.barcode === code || product.sku === code);

    if (!match) {
      // No está en la lista con la que se abrió la pantalla, pero puede haberse
      // cargado recién. Antes de decir "no está", preguntamos.
      await lookupOnServer(code);
      return;
    }

    takeScanned({
      productId: match.productId,
      name: match.name,
      price: match.price,
      unit: match.unit,
      stock: match.stock,
      imageVersion: match.imageVersion,
      catalogSlug: match.catalogSlug,
      packSize: match.packSize,
      packLabel: match.packLabel,
    });
  }

  // Segunda oportunidad: el código no estaba en la lista local. La base sabe si
  // el producto existe, si le falta precio en esta sucursal o si no está.
  async function lookupOnServer(code: string) {
    if (!branch) return;

    avisar("warn", "Buscando…", 4000);
    const result = await findProductToSell({ code, branchId: branch.id });

    if (result.status === "sellable") {
      const encontrado: PosProduct = {
        productId: result.product.productId,
        name: result.product.name,
        price: result.product.price,
        unit: result.product.unit as PosProduct["unit"],
        sku: null,
        barcode: code,
        stock: result.product.stock,
        imageVersion: result.product.imageVersion,
        catalogSlug: result.product.catalogSlug,
        packSize: result.product.packSize,
        packLabel: result.product.packLabel,
        familyId: null,
        familyName: null,
        variantLabel: null,
        // Lo escaneado no trae categoría: cae en "Todo" y se ve igual.
        categoryName: null,
        categoryColor: null,
      };

      setExtraProducts((current) => [...current, encontrado]);
      setScanFeedback(null);
      takeScanned({
        productId: encontrado.productId,
        name: encontrado.name,
        price: encontrado.price,
        unit: encontrado.unit,
        stock: encontrado.stock,
        imageVersion: encontrado.imageVersion,
        catalogSlug: encontrado.catalogSlug,
        packSize: encontrado.packSize,
        packLabel: encontrado.packLabel,
      });
      return;
    }

    if (result.status === "no-price") {
      avisar("warn", `${result.name}: está cargado pero sin precio en esta sucursal`, 3600);
      return;
    }

    if (result.status === "unavailable") {
      avisar("warn", `${result.name}: está apagado para vender en esta sucursal`, 3600);
      return;
    }

    if (result.status === "inactive") {
      avisar("warn", `${result.name}: está dado de baja del catálogo`, 3600);
      return;
    }

    avisar("warn", `Código ${code}: no está cargado todavía`, 3000);
  }

  // Confirmado: entra al pedido y el lector queda listo para el siguiente.
  function confirmScanned(quantity: number) {
    if (!scanned) return;

    const producto = scanned;
    setScanned(null);
    pushScanned(producto, quantity);
  }

  // Carga directa de cantidad, para lo que se vende por peso o por metro.
  function setProductQuantity(productId: string, raw: string, unit: Unit) {
    const quantity = parseQuantityInput(raw, unit);

    setCart((current) => {
      if (quantity === null) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity };
    });
  }

  function removeProduct(productId: string) {
    setCart((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function openCheckout() {
    if (!hasItems) return;
    setSplitMode(false);
    setSplitRows([]);
    setError(null);
    setCheckoutOpen(true);
  }

  function toggleSplit() {
    setSplitMode((open) => {
      const next = !open;
      if (next) setSplitRows([{ id: 1, method: singleMethod, amount: total > 0 ? String(total) : "" }]);
      return next;
    });
  }

  function addSplitRow() {
    const used = new Set(splitRows.map((row) => row.method));
    const nextMethod = paymentOptions.find((option) => !used.has(option.value))?.value ?? paymentOptions[0]?.value ?? "";
    const nextId = Math.max(0, ...splitRows.map((row) => row.id)) + 1;
    setSplitRows((rows) => [...rows, { id: nextId, method: nextMethod, amount: splitRemaining > 0 ? String(splitRemaining) : "" }]);
  }

  function updateSplitRow(id: number, patch: Partial<SplitRow>) {
    setSplitRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeSplitRow(id: number) {
    setSplitRows((rows) => rows.filter((row) => row.id !== id));
  }

  function confirm() {
    if (!branch || !canConfirm) return;
    setError(null);

    const payments: SubmitSaleInput["payments"] = splitMode
      ? splitRows.map((row) => ({ method: row.method as PaymentMethod, amount: Math.round(Number(row.amount) || 0) }))
      : [{ method: singleMethod as PaymentMethod, amount: total }];

    startTransition(async () => {
      const result = await submitSale({
        branchId: branch.id,
        staffId,
        customerId: customerId || undefined,
        appointmentId: appointment?.id,
        quoteId: quote?.id,
        items: cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        payments,
        ...(wantsInvoice
          ? { customerName: customerName.trim() || undefined, customerTaxId: customerTaxId.trim() || undefined, customerTaxCondition }
          : {}),
      });
      if (result.ok) {
        setCart({});
        setSplitRows([]);
        setSplitMode(false);
        setWantsInvoice(false);
        setCustomerName("");
        setCustomerTaxId("");
        setCustomerId("");
        setCustomerTaxCondition(TaxCondition.CONSUMIDOR_FINAL);
        setCheckoutOpen(false);
        setSuccess(true);
        window.setTimeout(() => setSuccess(false), 1700);
      } else {
        setError(result.error);
      }
    });
  }

  if (!branch) {
    return (
      <main className="mx-auto min-h-screen max-w-[560px] px-4 py-10 text-slate-950">
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">
          No hay sucursales con empleados y servicios activos. Cargá una sucursal para vender.
        </div>
      </main>
    );
  }

  return (
    // El nav de abajo es flotante: no ocupa lugar en el flujo, así que
    // reservarle 7rem acá era regalar alto. La pantalla llega hasta el borde y
    // el catálogo pasa POR DEBAJO del nav; el respiro se lo damos adentro del
    // scroll, donde solo empuja al último renglón.
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-[560px] flex-col overflow-x-clip px-4 pb-40 pt-6 text-slate-950 lg:h-screen lg:max-w-none lg:overflow-hidden lg:px-8 lg:pb-6">
      {/* Sin encabezado propio: el nombre del negocio y un título que dice
          "Nueva venta" en una pantalla a la que se entra a propósito son dos
          renglones de alto que no informan nada, y acá el alto es el catálogo.
          Para volver está el nav de abajo, que además marca dónde estás. El
          título de la primera tarjeta oficia de título de la pantalla. */}
      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_22rem] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-6">
        <div className="lg:flex lg:min-h-0 lg:min-w-0 lg:flex-col">
      {branches.length > 1 ? (
        <Step icon={Store} step={branchStep} title="Sucursal" delay={80}>
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {branches.map((item) => (
              <button
                className={`shrink-0 rounded-2xl px-5 py-4 text-base font-black transition active:scale-95 ${
                  item.id === branchId ? "bg-primary text-white shadow-sm shadow-primary/25" : "bg-white text-slate-700 ring-1 ring-slate-950/5"
                }`}
                key={item.id}
                onClick={() => selectBranch(item.id)}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>
        </Step>
      ) : null}

      {preguntarStaff ? (
      <Step iconName={staffIcon} step={staffStep} title="¿Quién atiende?" delay={140}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {branch.staffs.map((staff) => {
            const active = staff.id === staffId;
            return (
              <button
                className={`flex items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                  active ? "bg-primary text-white shadow-sm shadow-primary/25" : "bg-white text-slate-700 ring-1 ring-slate-950/5"
                }`}
                data-testid="staff-option"
                key={staff.id}
                onClick={() => chooseStaff(staff.id)}
                type="button"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    active ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                  }`}
                >
                  {initials(staff.name)}
                </span>
                <span className="min-w-0 text-sm font-black leading-tight">{staff.name}</span>
              </button>
            );
          })}
        </div>
      </Step>
      ) : null}

      <Step crece iconName={catalogIcon} step={productStep} title="¿Qué se llevó?" delay={200}>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/15"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={features.barcodes ? "Buscar por nombre o código…" : `Buscar ${catalogSingular.toLowerCase()}…`}
              value={search}
            />
          </div>
          {/* Escanear es más rápido que buscar: va al lado, del mismo tamaño.
              Donde no hay códigos (una barbería) no se muestra. */}
          {features.barcodes ? (
            <button
              aria-label="Escanear código"
              className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white transition active:scale-95"
              onClick={() => setScanning(true)}
              type="button"
            >
              <QrCode className="size-6" />
            </button>
          ) : null}
        </div>
        {categorias.length > 1 ? (
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                categoria === null ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
              }`}
              onClick={() => setCategoria(null)}
              type="button"
            >
              Todo
            </button>
            {categorias.map((c) => (
              <button
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                  categoria === c.nombre ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-950/5"
                }`}
                key={c.nombre}
                onClick={() => setCategoria(c.nombre)}
                type="button"
              >
                {/* El punto de color es de la categoría: en un catálogo largo se
                    reconoce antes por color que leyendo. */}
                {c.color ? (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                ) : null}
                {c.nombre}
              </button>
            ))}
          </div>
        ) : null}

        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
        {/* El colchón va acá adentro y no en el contenedor: así el área que
            scrollea llega hasta el fondo de la pantalla, y lo único que el nav
            flotante empuja es el último renglón, que se termina de ver
            scrolleando. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:pb-24 xl:grid-cols-4 2xl:grid-cols-5">
          {gridEntries.map((entry) => {
            const product = entry.product;
            const imageSrc = posImageSrc(product);

            // Modelo con talles: una tarjeta que abre el selector.
            if (entry.kind === "family") {
              const inCart = entry.variants.reduce((sum, variant) => sum + (cart[variant.productId] ?? 0), 0);

              return (
                <button
                  className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.99] ${
                    inCart > 0 ? "border-primary bg-primary/10" : "border-slate-200 bg-white"
                  }`}
                  key={`family-${product.familyId}`}
                  onClick={() => setOpenFamily(product.familyId)}
                  type="button"
                >
                  {showsPhotos ? (
                    imageSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="mb-2 aspect-square w-full rounded-xl bg-slate-100 object-cover"
                        loading="lazy"
                        src={imageSrc}
                      />
                    ) : (
                      <span className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100">
                        <DynamicIcon className="size-8 text-slate-300" name={catalogIcon} />
                      </span>
                    )
                  ) : null}
                  <span className="block text-base font-black leading-tight text-slate-950">
                    {product.familyName ?? product.name}
                  </span>
                  <span className="mt-1.5 block text-lg font-black text-primary">{money(product.price)}</span>
                  <span className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-slate-100 text-sm font-black text-slate-700">
                    {inCart > 0 ? `${formatQuantity(inCart)} en el pedido` : `${entry.variants.length} talles`}
                  </span>
                </button>
              );
            }

            const quantity = cart[product.productId] ?? 0;
            const active = quantity > 0;
            const byWeight = allowsFraction(product.unit);
            const outOfStock = product.stock !== null && product.stock <= 0;
            const overStock = product.stock !== null && quantity > product.stock;

            return (
              <div
                className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl border-2 p-3.5 transition ${
                  overStock
                    ? "border-rose-400 bg-rose-50"
                    : active
                      ? "border-primary bg-primary/10"
                      : "border-slate-200 bg-white"
                }`}
                key={product.productId}
              >
                <button className="text-left active:scale-[0.99]" onClick={() => addProduct(product.productId)} type="button">
                  {showsPhotos ? (
                    imageSrc ? (
                      <span className="relative mb-2 block">
                        {/* Miniatura ya normalizada por el servidor. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt=""
                          className="aspect-square max-h-40 w-full rounded-xl bg-slate-100 object-cover lg:max-h-32"
                          loading="lazy"
                          src={imageSrc}
                        />
                        {/* Sobre la foto y no debajo del precio: lo que no se
                            puede vender tiene que verse ANTES de tocarlo. */}
                        {outOfStock ? (
                          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2.5 py-1 text-[0.7rem] font-black text-white">
                            Sin stock
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100">
                        <DynamicIcon className="size-8 text-slate-300" name={catalogIcon} />
                      </span>
                    )
                  ) : null}
                  <span className="block text-base font-black leading-tight text-slate-950">{product.name}</span>
                  <span className="mt-1.5 block text-lg font-black text-primary">
                    {money(product.price)}
                    {byWeight ? <span className="text-xs font-bold text-primary">/{unitShort(product.unit)}</span> : null}
                  </span>
                  {product.stock !== null && !(outOfStock && showsPhotos && imageSrc) ? (
                    <span
                      className={`mt-0.5 block text-[0.7rem] font-bold ${
                        outOfStock ? "text-rose-600" : overStock ? "text-rose-600" : "text-slate-400"
                      }`}
                    >
                      {outOfStock ? "Sin stock" : `Quedan ${formatQuantity(product.stock, product.unit)}`}
                    </span>
                  ) : null}
                </button>

                {byWeight ? (
                  // Por peso o por metro no tiene sentido el +/-: se tipea.
                  <label className="mt-3 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-primary/20">
                    <input
                      aria-label={`Cantidad de ${product.name} en ${unitShort(product.unit)}`}
                      className="w-full min-w-0 bg-transparent text-base font-black text-slate-950 outline-none"
                      inputMode="decimal"
                      onChange={(event) => setProductQuantity(product.productId, event.target.value, product.unit)}
                      placeholder="0"
                      value={quantity ? formatQuantity(quantity) : ""}
                    />
                    <span className="shrink-0 text-xs font-black text-slate-400">{unitShort(product.unit)}</span>
                  </label>
                ) : active ? (
                  <div className="mt-3 flex items-center justify-between rounded-full bg-white p-1 ring-1 ring-primary/20">
                    <button
                      aria-label={`Restar ${product.name}`}
                      className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition active:scale-90"
                      onClick={() => decreaseProduct(product.productId)}
                      type="button"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="text-lg font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQuantity(quantity)}
                    </span>
                    <button
                      aria-label={`Sumar ${product.name}`}
                      className="flex size-9 items-center justify-center rounded-full bg-primary text-white transition active:scale-90"
                      onClick={() => addProduct(product.productId)}
                      type="button"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                ) : null}

                {features.packs && product.packSize && product.packSize > 1 && !byWeight ? (
                  <button
                    aria-label={`Agregar ${product.packLabel ?? "bulto"} de ${product.name}`}
                    className="mt-1.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 text-xs font-black text-white transition active:scale-[0.97]"
                    onClick={() => addPack(product.productId, product.packSize as number)}
                    type="button"
                  >
                    <Plus className="size-3.5" />
                    {product.packLabel ?? "Bulto"} × {product.packSize}
                  </button>
                ) : null}
              </div>
            );
          })}
          {filteredProducts.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
              No encontramos ningún {catalogSingular.toLowerCase()} con eso.
            </p>
          ) : null}
        </div>
        </div>
      </Step>
        </div>

        {/* Sin alto calculado a mano: un `calc(100vh-…)` no sabe del encabezado
          ni del lugar reservado para el nav, y el panel terminaba abajo del
          borde con el botón de cobro cortado. Como item del grid, la fila ya
          lo acota.

          El catálogo puede pasar por debajo del nav flotante porque scrollea,
          pero el botón de cobro no: si queda tapado, no se cobra. El nav va
          centrado en la ventana (máx. 35rem) y esta columna mide 22rem contra
          el borde derecho, así que se cruzan solo en ventanas angostas. Ahí le
          dejamos el lugar; de ~1330px para arriba el carrito llega hasta abajo
          y gana los 96px. Medido: el botón queda libre en todo el rango. */}
        <aside className="hidden max-[1327px]:pb-24 lg:block lg:h-full">
          {/* Alto completo con el total abajo: en un mostrador la vista queda
              abierta todo el día, y el número que se canta tiene que estar
              siempre en el mismo lugar. */}
          <div className="flex h-full flex-col rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
            {/* Mismo tamaño e icono que el título de las tarjetas de la
                izquierda: son dos encabezados de la misma fila, y si uno es más
                chico la fila se ve torcida aunque las cajas estén alineadas. */}
            <h2 className="flex items-center gap-2.5 text-lg font-black text-slate-950">
              <ShoppingBag className="size-5 text-primary" />
              Pedido
            </h2>
            {hasItems ? (
              <>
                <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div className="flex items-center gap-2 text-sm" key={item.productId}>
                      <span className="min-w-0 flex-1 truncate font-bold text-slate-700">
                        {item.name}{" "}
                        <span className="text-slate-400">
                          ×{formatQuantity(item.quantity, allowsFraction(item.unit) ? item.unit : undefined)}
                        </span>
                      </span>
                      <span className="shrink-0 font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {money(lineTotal(item.price, item.quantity))}
                      </span>
                    </div>
                  ))}
                </div>
                {discountTotal > 0 ? (
                  <div className="mt-3 space-y-1 rounded-2xl bg-emerald-50 p-3">
                    {livePreview?.discounts.map((discount) => (
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-800" key={discount.description}>
                        <span className="min-w-0 truncate">{discount.description}</span>
                        <span className="shrink-0">−{money(discount.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-bold text-slate-500">Total</span>
                  <span className="text-right">
                    {discountTotal > 0 ? (
                      <span className="block text-sm font-bold text-slate-400 line-through">{money(listTotal)}</span>
                    ) : null}
                    <span className="block text-2xl font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(total)}
                    </span>
                  </span>
                </div>
                <button
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-black text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99]"
                  onClick={openCheckout}
                  type="button"
                >
                  Cobrar
                  <ArrowRight className="size-4" />
                </button>
              </>
            ) : (
              <>
                {/* Centrado y no arriba: la columna es alta y un cartel pegado
                    al título deja medio metro de blanco debajo. */}
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <ShoppingBag className="size-10 text-slate-200" />
                  <p className="text-base font-black text-slate-700">Carrito vacío</p>
                  {/* El rubro pone la palabra: en una panadería no se vende un
                      "servicio". */}
                  <p className="text-sm text-slate-500">
                    Tocá un {catalogSingular.toLowerCase()} para sumarlo.
                  </p>
                </div>

                {/* El total queda a la vista aunque esté en cero: es el número
                    que el cajero canta, y tiene que estar SIEMPRE en el mismo
                    lugar de la pantalla, no aparecer recién al primer toque. */}
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
                  <span className="text-base font-black text-slate-950">Total</span>
                  <span
                    className="text-2xl font-black text-primary"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {money(0)}
                  </span>
                </div>
                <button
                  className="mt-3 w-full rounded-2xl bg-primary/40 px-4 py-4 text-base font-black text-white"
                  disabled
                  type="button"
                >
                  Continuar al cobro
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Barra de pedido (abrir checkout) — solo mobile/tablet chico */}
      <div className="fixed inset-x-0 bottom-[4.75rem] z-30 mx-auto max-w-[560px] px-4 sm:bottom-[7rem] lg:hidden">
        <button
          className={`flex w-full items-center gap-3 rounded-[1.5rem] p-2.5 pl-5 text-left shadow-[0_-8px_40px_rgba(15,23,42,0.16)] transition active:scale-[0.99] ${
            hasItems ? "bg-primary" : "pointer-events-none bg-slate-300"
          }`}
          disabled={!hasItems}
          onClick={openCheckout}
          type="button"
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <ShoppingBag className="size-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-white text-xs font-black text-primary">
                {itemCount}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-white/80">{hasItems ? "Total" : `Agregá ${catalogPlural.toLowerCase()}`}</span>
            <span className="block text-2xl font-black text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
              {money(total)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 rounded-2xl bg-white px-5 py-4 text-sm font-black text-primary">
            Continuar
            <ArrowRight className="size-4" />
          </span>
        </button>
      </div>

      <BarcodeScanner
        feedback={scanFeedback}
        hint="Pasá un producto atrás de otro"
        mode="continuous"
        onClose={() => {
          setScanning(false);
          setScanFeedback(null);
          setLastAddedId(null);
        }}
        onDetect={(code) => void handleScan(code)}
        open={scanning}
        // El pedido, abajo de la cámara y en vivo: lo que se escanea se ve
        // entrar, con su cantidad y el total, sin cerrar el lector.
        panel={
          <>
            <div className="flex items-start justify-between gap-3 px-4 pt-4">
              <div className="min-w-0">
                <p className="text-base font-black tracking-tight text-slate-950">Escaneados</p>
                <p className="text-xs font-bold text-slate-400">
                  {itemCount === 0
                    ? "Todavía no pasaste nada"
                    : `${itemCount} ${itemCount === 1 ? catalogSingular.toLowerCase() : catalogPlural.toLowerCase()}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Total</p>
                <p className="text-xl font-black tabular-nums text-slate-950">{money(total)}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3" data-testid="scan-cart">
              {hasItems ? (
                cartItems.map((item) => {
                  const sinStock = item.stock !== null && item.quantity > item.stock;
                  const imageSrc = posImageSrc(item);

                  return (
                    <div
                      className={`flex items-center gap-2.5 rounded-2xl p-2.5 transition ${
                        item.productId === lastAddedId ? "bg-primary/10 ring-2 ring-primary" : "bg-slate-50"
                      }`}
                      key={item.productId}
                    >
                      {imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="size-11 shrink-0 rounded-xl bg-white object-cover"
                          src={imageSrc}
                        />
                      ) : (
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                          <DynamicIcon className="size-5" name={catalogIcon} />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black leading-tight text-slate-950">{item.name}</p>
                        <p className="text-xs font-bold tabular-nums text-slate-500">
                          {money(lineTotal(item.price, item.quantity))}
                          <span className="text-slate-400"> · {money(item.price)} c/u</span>
                        </p>
                        {sinStock ? <p className="text-xs font-bold text-amber-600">Más de lo que te queda</p> : null}

                        {/* El bulto entero, sin tocar "+" doce veces. */}
                        {item.packSize && item.packSize > 1 ? (
                          <button
                            className="mt-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-white transition active:scale-95"
                            onClick={() => addPack(item.productId, item.packSize as number)}
                            type="button"
                          >
                            + {item.packLabel ?? "Bulto"} ×{item.packSize}
                          </button>
                        ) : null}
                      </div>

                      {allowsFraction(item.unit) ? (
                        // Por peso no hay +/-: la cantidad la dio la balanza.
                        <span className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-black tabular-nums text-slate-700">
                          {formatQuantity(item.quantity, item.unit)}
                        </span>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            aria-label={`Restar ${item.name}`}
                            className="flex size-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition active:scale-90"
                            onClick={() => decreaseProduct(item.productId)}
                            type="button"
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="w-7 text-center text-base font-black tabular-nums text-slate-950">
                            {formatQuantity(item.quantity)}
                          </span>
                          <button
                            aria-label={`Sumar ${item.name}`}
                            className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition active:scale-90"
                            onClick={() => addProduct(item.productId)}
                            type="button"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <QrCode className="size-6" />
                  </span>
                  <p className="text-sm font-bold text-slate-400">
                    Lo que escanees aparece acá, con la cantidad y el total.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <button
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
                data-testid="scan-review"
                disabled={!hasItems}
                onClick={() => {
                  setScanning(false);
                  setScanFeedback(null);
                  setLastAddedId(null);
                }}
                type="button"
              >
                <span className="text-base font-black">Revisar el pedido</span>
                <span className="text-lg font-black tabular-nums">{money(total)}</span>
              </button>
            </div>
          </>
        }
        title="Escanear para vender"
      />

      {/* Confirmación de lo escaneado: qué es y cuántos. */}
      <ScanConfirmSheet
        alreadyInCart={scanned ? cart[scanned.productId] ?? 0 : 0}
        catalogIcon={catalogIcon}
        key={scanned?.productId ?? "vacio"}
        onCancel={() => setScanned(null)}
        onConfirm={confirmScanned}
        product={scanned}
      />

      {/* Selector de talles de un modelo */}
      <BottomSheet onClose={() => setOpenFamily(null)} open={openFamily !== null}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pt-6">
            <h3 className="text-xl font-black tracking-tight text-slate-950">
              {familyVariants[0]?.familyName ?? "Elegí el talle"}
            </h3>
            <p className="text-sm text-slate-500">Cada talle tiene su propio stock.</p>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-5">
            {familyVariants.map((variant) => {
              const quantity = cart[variant.productId] ?? 0;
              const outOfStock = variant.stock !== null && variant.stock <= 0;

              return (
                <div
                  className={`flex items-center gap-3 rounded-2xl p-3 ${quantity > 0 ? "bg-primary/10" : "bg-slate-50"}`}
                  key={variant.productId}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-950">{variant.variantLabel ?? variant.name}</p>
                    <p className="text-xs text-slate-500">
                      {variant.stock !== null
                        ? outOfStock
                          ? "Sin stock"
                          : `Quedan ${formatQuantity(variant.stock, variant.unit)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center rounded-full bg-white p-1 ring-1 ring-slate-950/5">
                    <button
                      aria-label={`Restar ${variant.name}`}
                      className="flex size-9 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                      onClick={() => decreaseProduct(variant.productId)}
                      type="button"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-base font-black">{formatQuantity(quantity)}</span>
                    <button
                      aria-label={`Sumar ${variant.name}`}
                      className="flex size-9 items-center justify-center rounded-full bg-primary text-white transition active:scale-90"
                      onClick={() => addProduct(variant.productId)}
                      type="button"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-black text-white transition active:scale-[0.99]"
              onClick={() => setOpenFamily(null)}
              type="button"
            >
              Listo
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Hoja: revisar y pagar */}
      <BottomSheet onClose={() => setCheckoutOpen(false)} open={checkoutOpen} panelClassName="min-h-[70dvh]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pt-6">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-950">Confirmar venta</h3>
              <p className="text-sm text-slate-500">{selectedStaff ? `Atiende ${selectedStaff.name}` : ""}</p>
            </div>
            <button
              aria-label="Cerrar"
              className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-90"
              onClick={() => setCheckoutOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-5">
            {/* Pedido */}
            <section>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Tu pedido</p>
              <div className="space-y-2">
                {cartItems.map((item) => {
                  const imageSrc = posImageSrc(item);

                  return (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5" key={item.productId}>
                    {imageSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="size-10 shrink-0 rounded-xl object-cover"
                        src={imageSrc}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {money(item.price)} {allowsFraction(item.unit) ? `por ${unitShort(item.unit)}` : "c/u"}
                      </p>
                    </div>
                    {allowsFraction(item.unit) ? (
                      // Lo que se vende por peso no se ajusta con +/-: se muestra
                      // la cantidad cargada y se corrige en la grilla.
                      <span
                        className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700 ring-1 ring-slate-950/5"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatQuantity(item.quantity, item.unit)}
                      </span>
                    ) : (
                      <div className="flex items-center rounded-full bg-white p-1 ring-1 ring-slate-950/5">
                        <button
                          aria-label={`Restar ${item.name}`}
                          className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                          onClick={() => decreaseProduct(item.productId)}
                          type="button"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-7 text-center text-sm font-black" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatQuantity(item.quantity)}
                        </span>
                        <button
                          aria-label={`Sumar ${item.name}`}
                          className="flex size-8 items-center justify-center rounded-full text-slate-600 transition active:scale-90"
                          onClick={() => addProduct(item.productId)}
                          type="button"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    )}
                    <p className="w-20 shrink-0 text-right text-sm font-black text-slate-950" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money(lineTotal(item.price, item.quantity))}
                    </p>
                    <button
                      aria-label={`Quitar ${item.name}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 hover:text-rose-600"
                      onClick={() => removeProduct(item.productId)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  );
                })}
                {!hasItems ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                    El pedido está vacío.
                  </p>
                ) : null}
              </div>

              {/* Por qué el total es menor que la suma de los renglones. Sin esto,
                  el vendedor no puede explicarle el precio al cliente. */}
              {discountTotal > 0 ? (
                <div className="mt-3 rounded-2xl bg-emerald-50 p-3.5">
                  {livePreview?.discounts.map((discount) => (
                    <div
                      className="flex items-center justify-between gap-2 text-sm font-bold text-emerald-800"
                      key={discount.description}
                    >
                      <span className="min-w-0 truncate">{discount.description}</span>
                      <span className="shrink-0">−{money(discount.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2 text-sm">
                    <span className="font-bold text-emerald-700">Antes</span>
                    <span className="font-bold text-emerald-700 line-through">{money(listTotal)}</span>
                  </div>
                </div>
              ) : null}
            </section>

            {/* Cliente: hace falta para fiar y sirve para el historial de compras. */}
            {customers.length > 0 ? (
              <section>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">¿Quién compra?</p>
                <select
                  aria-label="Cliente"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:bg-white"
                  onChange={(event) => setCustomerId(event.target.value)}
                  value={customerId}
                >
                  <option value="">Cliente ocasional</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.balance > 0 ? ` — debe ${money(customer.balance)}` : ""}
                    </option>
                  ))}
                </select>
                {selectedCustomer && selectedCustomer.creditLimit !== null ? (
                  <p className="mt-1.5 text-xs font-semibold text-slate-500">
                    Puede fiar hasta {money(Math.max(selectedCustomer.creditLimit - selectedCustomer.balance, 0))} más.
                  </p>
                ) : null}
                {usesAccount && !customerId ? (
                  <p className="mt-1.5 text-xs font-bold text-rose-600">
                    Para cobrar en cuenta corriente elegí un cliente.
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* Pago */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">¿Cómo paga?</p>
                <button
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-95 ${
                    splitMode ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                  }`}
                  onClick={toggleSplit}
                  type="button"
                >
                  <Split className="size-3.5" />
                  Dividir
                </button>
              </div>

              {splitMode ? (
                <div className="space-y-2.5">
                  {splitRows.map((row) => (
                    <div className="flex items-center gap-2" key={row.id}>
                      <select
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-primary/40 focus:bg-white"
                        onChange={(event) => updateSplitRow(row.id, { method: event.target.value })}
                        value={row.method}
                      >
                        {paymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2 focus-within:border-primary/40 focus-within:bg-white">
                        <span className="text-sm font-bold text-slate-400">$</span>
                        <input
                          aria-label="Monto del pago"
                          className="w-20 bg-transparent px-1 py-3 text-right text-sm font-black text-slate-950 outline-none"
                          inputMode="numeric"
                          onChange={(event) => updateSplitRow(row.id, { amount: event.target.value.replace(/\D/g, "") })}
                          placeholder="0"
                          value={formatAmountInput(row.amount)}
                        />
                      </div>
                      {splitRows.length > 1 ? (
                        <button
                          aria-label="Quitar pago"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 hover:text-rose-600"
                          onClick={() => removeSplitRow(row.id)}
                          type="button"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    {splitRows.length < paymentOptions.length ? (
                      <button className="text-sm font-black text-primary" onClick={addSplitRow} type="button">
                        + Agregar método
                      </button>
                    ) : (
                      <span />
                    )}
                    <span className={`text-sm font-black ${splitRemaining === 0 ? "text-emerald-600" : "text-slate-500"}`}>
                      {splitRemaining === 0 ? "✓ Cubierto" : `Falta ${money(splitRemaining)}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {paymentOptions.map((option) => {
                    const Icon = paymentIcons[option.value] ?? Wallet;
                    const active = singleMethod === option.value;
                    return (
                      <button
                        className={`flex items-center gap-2.5 rounded-2xl px-4 py-4 text-sm font-black transition active:scale-95 ${
                          active ? "bg-primary text-white shadow-sm shadow-primary/25" : "bg-slate-100 text-slate-700"
                        }`}
                        key={option.value}
                        onClick={() => setSingleMethod(option.value)}
                        type="button"
                      >
                        <Icon className="size-5" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* El vuelto. Es la cuenta que hoy hace el vendedor de cabeza con
                  el cliente enfrente, y la que más se equivoca con apuro. */}
              {!splitMode && singleMethod === "CASH" && total > 0 ? (
                <div className="mt-3 rounded-2xl bg-slate-50 p-3.5">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">¿Con cuánto paga?</p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      className={`rounded-xl px-3 py-2.5 text-sm font-black transition active:scale-95 ${
                        cashReceived === "" ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
                      }`}
                      onClick={() => setCashReceived("")}
                      type="button"
                    >
                      Justo
                    </button>
                    {quickCashAmounts(total).map((amount) => (
                      <button
                        className={`rounded-xl px-3 py-2.5 text-sm font-black transition active:scale-95 ${
                          cashReceived === String(amount)
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-700 ring-1 ring-slate-200"
                        }`}
                        key={amount}
                        onClick={() => setCashReceived(String(amount))}
                        type="button"
                      >
                        {money(amount)}
                      </button>
                    ))}
                  </div>

                  <label className="mt-2 flex items-center rounded-xl border border-slate-200 bg-white px-3">
                    <span className="text-base font-black text-slate-400">$</span>
                    <input
                      aria-label="Con cuánto paga"
                      className="w-full min-w-0 bg-transparent px-2 py-2.5 text-base font-black text-slate-950 outline-none"
                      inputMode="numeric"
                      onChange={(event) => setCashReceived(event.target.value.replace(/\D/g, ""))}
                      placeholder="Otro monto"
                      value={formatAmountInput(cashReceived)}
                    />
                  </label>

                  {cashReceived !== "" ? (
                    coversTotal(total, Number(cashReceived)) ? (
                      <div className="mt-2.5 flex items-baseline justify-between rounded-xl bg-emerald-50 px-3.5 py-3">
                        <span className="text-sm font-black uppercase tracking-wide text-emerald-700">Vuelto</span>
                        <span className="text-3xl font-black tracking-tight text-emerald-700">
                          {money(changeFor(total, Number(cashReceived)))}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm font-bold text-amber-700">
                        Con eso no alcanza: faltan {money(total - Number(cashReceived))}.
                      </p>
                    )
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* Datos fiscales del cliente (opcional) */}
            <section>
              <button
                className={`flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.99] ${
                  wantsInvoice ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-slate-100 text-slate-600"
                }`}
                onClick={() => setWantsInvoice((value) => !value)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <ReceiptText className="size-4" />
                  Facturar a nombre de un cliente (opcional)
                </span>
                <span className="text-xs font-bold">{wantsInvoice ? "Ocultar" : "Agregar"}</span>
              </button>

              {wantsInvoice ? (
                <div className="mt-2.5 space-y-2.5 rounded-2xl bg-slate-50 p-3.5">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/15"
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Nombre o razón social"
                    type="text"
                    value={customerName}
                  />
                  <input
                    className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:ring-4 ${
                      customerTaxIdHasError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-primary/40 focus:ring-primary/15"
                    }`}
                    inputMode="numeric"
                    onChange={(event) => setCustomerTaxId(event.target.value)}
                    placeholder="CUIT o DNI (opcional)"
                    type="text"
                    value={customerTaxId}
                  />
                  {customerTaxIdHasError ? <p className="text-xs font-semibold text-rose-600">CUIT/DNI inválido.</p> : null}
                  {customerTaxIdCheck?.kind === "CUIT" && customerTaxIdCheck.valid ? (
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/15"
                      onChange={(event) => setCustomerTaxCondition(event.target.value as TaxCondition)}
                      value={customerTaxCondition}
                    >
                      {Object.values(TaxCondition).map((condition) => (
                        <option key={condition} value={condition}>
                          {TAX_CONDITION_LABELS[condition]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <p className="text-xs text-slate-500">Sin CUIT, se factura a Consumidor Final.</p>
                </div>
              ) : null}
            </section>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {/* Footer: confirmar */}
          <div className="mt-auto border-t border-slate-100 px-5 pb-1 pt-4">
            <button
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-6 py-4 text-white shadow-sm shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={!canConfirm || isPending}
              onClick={confirm}
              type="button"
            >
              <span className="text-base font-black">{isPending ? "Registrando…" : "Confirmar venta"}</span>
              <span className="text-lg font-black" style={{ fontVariantNumeric: "tabular-nums" }}>
                {money(total)}
              </span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {success ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm duration-200 animate-in fade-in">
          <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-white px-12 py-10 shadow-2xl duration-300 animate-in zoom-in-95">
            <span className="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="size-11" />
            </span>
            <p className="text-xl font-black text-slate-950">¡Venta registrada!</p>
            <p className="text-sm text-slate-500">Ya podés cargar la siguiente.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Step({
  icon: Icon,
  iconName,
  step,
  title,
  delay,
  children,
  crece = false,
}: {
  icon?: ComponentType<{ className?: string }>;
  // Icono elegido por el rubro (nombre) en vez de un componente fijo.
  iconName?: string;
  step: number;
  title: string;
  delay: number;
  children: React.ReactNode;
  // Este paso ocupa el alto que sobra y scrollea por dentro. En una caja la
  // pantalla es fija: lo único que se mueve es la grilla de productos.
  crece?: boolean;
}) {
  return (
    <section
      // `first:mt-0`: la separación es ENTRE tarjetas, no arriba de la primera.
      // Sin esto la primera arrancaba 16px más abajo que el panel del carrito y
      // las dos columnas no leían como una sola fila. El `p-5` es el mismo del
      // carrito, para que los dos títulos caigan a la misma altura.
      className={`mt-4 rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3 first:mt-0 ${
        crece ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : ""
      }`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-black text-slate-950">
        {/* Con un solo paso el número no ordena nada: es ruido en la pantalla
            que más se mira. */}
        {step > 1 ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-black text-white">
            {step}
          </span>
        ) : null}
        {iconName ? (
          <DynamicIcon className="size-5 text-primary" name={iconName} />
        ) : Icon ? (
          <Icon className="size-5 text-primary" />
        ) : null}
        {title}
      </h2>
      {crece ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </section>
  );
}
