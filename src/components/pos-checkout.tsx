"use client";

import { previewSale, submitSale, type SubmitSaleInput } from "@/app/sales/new/actions";
import type { PaymentMethod, Unit } from "@/generated/prisma/client";
import { TaxCondition } from "@/generated/prisma/enums";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TAX_CONDITION_LABELS } from "@/lib/invoice-labels";
import { allowsFraction, formatQuantity, lineTotal, ONE, parseQuantityInput, unitShort } from "@/lib/quantity";
import { changeFor, coversTotal, quickCashAmounts } from "@/modules/sales/change.logic";
import { validateTaxId } from "@/lib/tax-id";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Check,
  ChevronLeft,
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
import Link from "next/link";
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
  // Venta por bulto: cuántas unidades trae la caja y cómo se llama.
  packSize: number | null;
  packLabel: string | null;
  // Familia (modelo con talles/colores). null = producto suelto.
  familyId: string | null;
  familyName: string | null;
  variantLabel: string | null;
};

export type PosBranch = {
  id: string;
  name: string;
  businessName: string;
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
  const [staffId, setStaffId] = useState(
    appointment?.staffId ?? (branch?.staffs.length === 1 ? branch.staffs[0].id : ""),
  );

  // Se lee después del primer render: `localStorage` no existe en el servidor.
  useEffect(() => {
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
  const [scanFeedback, setScanFeedback] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
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

  const products = branch?.products ?? [];
  // Busca por nombre, SKU y código de barras: con un lector, escanear escribe el
  // código en este mismo campo y el producto queda filtrado solo.
  const filteredProducts = useMemo(() => {
    const list = branch?.products ?? [];
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
  }, [branch, search, salesRank]);

  // Con fotos, la grilla tiene que quedar pareja: si al menos un producto tiene,
  // todas las tarjetas reservan el cuadrado. Si ninguno tiene, no se reserva
  // nada y la grilla sigue tan compacta como antes.
  const showsPhotos = products.some((product) => product.imageVersion !== null);

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
  const staffStep = branchStep + 1;
  const productStep = staffStep + 1;

  function selectBranch(nextId: string) {
    const nextBranch = branches.find((item) => item.id === nextId);
    setBranchId(nextId);
    setStaffId(nextBranch?.staffs.length === 1 ? nextBranch.staffs[0].id : "");
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
  function handleScan(code: string) {
    const match = products.find(
      (product) => product.barcode === code || product.sku === code,
    );

    if (!match) {
      setScanFeedback({ tone: "warn", text: `Código ${code}: no está en el catálogo` });
      window.setTimeout(() => setScanFeedback(null), 2400);
      return;
    }

    if (allowsFraction(match.unit)) {
      // Lo que se vende por peso necesita que alguien lo pese: se agrega al
      // carrito y se avisa que hay que cargar la cantidad.
      setCart((current) => ({ ...current, [match.productId]: current[match.productId] ?? ONE }));
      setScanFeedback({ tone: "warn", text: `${match.name}: cargá los ${unitShort(match.unit)}` });
      window.setTimeout(() => setScanFeedback(null), 2600);
      return;
    }

    addProduct(match.productId);

    const nextQuantity = (cart[match.productId] ?? 0) / ONE + 1;
    setScanFeedback({ tone: "ok", text: `${match.name} ×${nextQuantity}` });
    window.setTimeout(() => setScanFeedback(null), 1600);
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
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-[560px] overflow-x-clip bg-[#f6f7fb] px-4 pb-40 pt-6 text-slate-950 lg:max-w-[1000px] lg:px-6 lg:pb-10">
      <header className="flex items-center gap-3 duration-500 animate-in fade-in slide-in-from-top-2">
        <Link
          aria-label="Volver"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-950/5 transition active:scale-95"
          href="/"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{branch.businessName}</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Nueva venta</h1>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-6">
        <div className="lg:min-w-0">
      {branches.length > 1 ? (
        <Step icon={Store} step={branchStep} title="Sucursal" delay={80}>
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {branches.map((item) => (
              <button
                className={`shrink-0 rounded-2xl px-5 py-4 text-base font-black transition active:scale-95 ${
                  item.id === branchId ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-700 ring-1 ring-slate-950/5"
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

      <Step iconName={staffIcon} step={staffStep} title="¿Quién atiende?" delay={140}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {branch.staffs.map((staff) => {
            const active = staff.id === staffId;
            return (
              <button
                className={`flex items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98] ${
                  active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-white text-slate-700 ring-1 ring-slate-950/5"
                }`}
                data-testid="staff-option"
                key={staff.id}
                onClick={() => chooseStaff(staff.id)}
                type="button"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    active ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
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

      <Step iconName={catalogIcon} step={productStep} title="¿Qué se llevó?" delay={200}>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-3 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gridEntries.map((entry) => {
            const product = entry.product;

            // Modelo con talles: una tarjeta que abre el selector.
            if (entry.kind === "family") {
              const inCart = entry.variants.reduce((sum, variant) => sum + (cart[variant.productId] ?? 0), 0);

              return (
                <button
                  className={`flex min-h-[7.5rem] flex-col justify-between rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.99] ${
                    inCart > 0 ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                  key={`family-${product.familyId}`}
                  onClick={() => setOpenFamily(product.familyId)}
                  type="button"
                >
                  {showsPhotos ? (
                    product.imageVersion ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="mb-2 aspect-square w-full rounded-xl bg-slate-100 object-cover"
                        loading="lazy"
                        src={`/api/products/${product.productId}/image?v=${product.imageVersion}`}
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
                  <span className="mt-1.5 block text-lg font-black text-blue-700">{money(product.price)}</span>
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
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-white"
                }`}
                key={product.productId}
              >
                <button className="text-left active:scale-[0.99]" onClick={() => addProduct(product.productId)} type="button">
                  {showsPhotos ? (
                    product.imageVersion ? (
                      // Miniatura ya normalizada por el servidor.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="mb-2 aspect-square w-full rounded-xl bg-slate-100 object-cover"
                        loading="lazy"
                        src={`/api/products/${product.productId}/image?v=${product.imageVersion}`}
                      />
                    ) : (
                      <span className="mb-2 flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100">
                        <DynamicIcon className="size-8 text-slate-300" name={catalogIcon} />
                      </span>
                    )
                  ) : null}
                  <span className="block text-base font-black leading-tight text-slate-950">{product.name}</span>
                  <span className="mt-1.5 block text-lg font-black text-blue-700">
                    {money(product.price)}
                    {byWeight ? <span className="text-xs font-bold text-blue-500">/{unitShort(product.unit)}</span> : null}
                  </span>
                  {product.stock !== null ? (
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
                  <label className="mt-3 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-blue-200">
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
                  <div className="mt-3 flex items-center justify-between rounded-full bg-white p-1 ring-1 ring-blue-200">
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
                      className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white transition active:scale-90"
                      onClick={() => addProduct(product.productId)}
                      type="button"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label={`Agregar ${product.name}`}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-slate-100 text-sm font-black text-slate-700 transition active:scale-[0.97]"
                    onClick={() => addProduct(product.productId)}
                    type="button"
                  >
                    <Plus className="size-4" />
                    Agregar
                  </button>
                )}

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
      </Step>
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
              <ShoppingBag className="size-4 text-blue-600" />
              Pedido
            </h2>
            {hasItems ? (
              <>
                <div className="mt-4 space-y-2">
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
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                  onClick={openCheckout}
                  type="button"
                >
                  Cobrar
                  <ArrowRight className="size-4" />
                </button>
              </>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Tocá un servicio para empezar.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Barra de pedido (abrir checkout) — solo mobile/tablet chico */}
      <div className="fixed inset-x-0 bottom-[4.75rem] z-30 mx-auto max-w-[560px] px-4 sm:bottom-[7rem] lg:hidden">
        <button
          className={`flex w-full items-center gap-3 rounded-[1.5rem] p-2.5 pl-5 text-left shadow-[0_-8px_40px_rgba(15,23,42,0.16)] transition active:scale-[0.99] ${
            hasItems ? "bg-blue-600" : "pointer-events-none bg-slate-300"
          }`}
          disabled={!hasItems}
          onClick={openCheckout}
          type="button"
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <ShoppingBag className="size-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-white text-xs font-black text-blue-700">
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
          <span className="flex items-center gap-1.5 rounded-2xl bg-white px-5 py-4 text-sm font-black text-blue-700">
            Continuar
            <ArrowRight className="size-4" />
          </span>
        </button>
      </div>

      <BarcodeScanner
        feedback={scanFeedback}
        hint={`${itemCount} ítem(s) en el carrito · ${money(total)}`}
        mode="continuous"
        onClose={() => {
          setScanning(false);
          setScanFeedback(null);
        }}
        onDetect={(code) => handleScan(code)}
        open={scanning}
        title="Escanear para vender"
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
                  className={`flex items-center gap-3 rounded-2xl p-3 ${quantity > 0 ? "bg-blue-50" : "bg-slate-50"}`}
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
                      className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white transition active:scale-90"
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
                {cartItems.map((item) => (
                  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5" key={item.productId}>
                    {item.imageVersion ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="size-10 shrink-0 rounded-xl object-cover"
                        src={`/api/products/${item.productId}/image?v=${item.imageVersion}`}
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
                ))}
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
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3.5 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white"
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
                    splitMode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
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
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-400 focus:bg-white"
                        onChange={(event) => updateSplitRow(row.id, { method: event.target.value })}
                        value={row.method}
                      >
                        {paymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2 focus-within:border-blue-400 focus-within:bg-white">
                        <span className="text-sm font-bold text-slate-400">$</span>
                        <input
                          aria-label="Monto del pago"
                          className="w-20 bg-transparent px-1 py-3 text-right text-sm font-black text-slate-950 outline-none"
                          inputMode="numeric"
                          onChange={(event) => updateSplitRow(row.id, { amount: event.target.value.replace(/\D/g, "") })}
                          placeholder="0"
                          value={row.amount}
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
                      <button className="text-sm font-black text-blue-600" onClick={addSplitRow} type="button">
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
                          active ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25" : "bg-slate-100 text-slate-700"
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
                      value={cashReceived}
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
                  wantsInvoice ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "bg-slate-100 text-slate-600"
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Nombre o razón social"
                    type="text"
                    value={customerName}
                  />
                  <input
                    className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:ring-4 ${
                      customerTaxIdHasError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-blue-400 focus:ring-blue-100"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
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
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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
}: {
  icon?: ComponentType<{ className?: string }>;
  // Icono elegido por el rubro (nombre) en vez de un componente fijo.
  iconName?: string;
  step: number;
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-950/5 duration-500 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <h2 className="mb-3 flex items-center gap-2.5 text-lg font-black text-slate-950">
        <span className="flex size-7 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">{step}</span>
        {iconName ? (
          <DynamicIcon className="size-5 text-blue-600" name={iconName} />
        ) : Icon ? (
          <Icon className="size-5 text-blue-600" />
        ) : null}
        {title}
      </h2>
      {children}
    </section>
  );
}
