import { AppModule, ProductKind, Unit, Vertical } from "@/generated/prisma/enums";

// El rubro NO condiciona la lógica de negocio: una venta se cobra igual en una
// negocio que en un kiosco. Lo único que define es el punto de partida —
// qué módulos vienen prendidos, cómo se llaman las cosas en pantalla y con qué
// catálogo arranca el negocio— para que nadie tenga que configurar una app
// vacía. Después cada negocio cambia lo que quiera.

export type VerticalLabels = {
  // El catálogo: "Servicios" en una barbería, "Productos" en un kiosco.
  catalogSingular: string;
  catalogPlural: string;
  catalogHint: string;
  // Quién atiende: "Barbero", "Vendedor", "Empleado".
  staffSingular: string;
  staffPlural: string;
  staffHint: string;
  // La acción de vender, tal como la nombra el rubro.
  sellAction: string;
  // Cómo se llama una venta ya hecha.
  saleSingular: string;
  salePlural: string;
};

// Qué herramientas le sirven a este rubro.
//
// No es lógica de negocio: una venta se cobra igual en todos lados. Es qué
// mostrar. Un botón de "modelo con talles" en una verdulería no es solo ruido:
// es una invitación a cargar mal los datos, y el error después aparece en el
// stock. La regla acá es la misma que con los módulos — si no le sirve, no se
// muestra.
export type VerticalFeatures = {
  // Modelos con talle y color (una remera S/M/L). Solo ropa y calzado.
  variants: boolean;
  // Código de barras: escanear para cargar y para vender. Un corte de pelo no
  // tiene código.
  barcodes: boolean;
  // Venta y compra por bulto (la caja de 24). Es de quien repone por cajón.
  packs: boolean;
  // Qué es un ítem nuevo por defecto: mercadería que se cuenta, o un servicio.
  // Antes esto se adivinaba mirando si el dueño había tipeado una cantidad al
  // darlo de alta, y una medialuna cargada sin poner cuántas tenía quedaba
  // guardada como SERVICIO sin control de stock. En silencio, y encima invisible
  // después: un servicio sin costo no avisa que le falta costo, así que el
  // agujero tampoco aparecía en la ganancia.
  goods: boolean;
  // Qué muestra la página pública del negocio, la que se comparte en el
  // Instagram o el estado de WhatsApp. Es lo único de la app pensado para traer
  // gente nueva, y cambia por completo según el rubro:
  //   "booking" → reservar turno (barbería, estética)
  //   "catalog" → catálogo con fotos y pedido por WhatsApp (ropa, ferretería)
  //   null      → no le sirve (un kiosco no vende por link)
  publicPage: "booking" | "catalog" | null;
};

export function verticalFeatures(vertical: Vertical): VerticalFeatures {
  return VERTICAL_PRESETS[vertical].features;
}

// Servicios: se agenda y se cobra, no se escanea ni viene en cajas.
const SERVICE_FEATURES: VerticalFeatures = { variants: false, barcodes: false, packs: false, goods: false, publicPage: "booking" };
// Comercio que repone mercadería por bulto y la pasa por lector.
const RESTOCK_FEATURES: VerticalFeatures = { variants: false, barcodes: true, packs: true, goods: true, publicPage: null };

export type SeedProduct = {
  name: string;
  price: number;
  category: string;
  kind?: ProductKind;
  unit?: Unit;
  cost?: number;
  stock?: number;
  // Qué producto del catálogo de rubro es. Le da la foto compartida sin que el
  // negocio suba nada. Ver `productImageSrc`.
  catalogSlug?: string;
};

export type VerticalPreset = {
  vertical: Vertical;
  label: string;
  tagline: string;
  // Ejemplo de nombre para el alta: "Ej: Kiosco El Rulo" no le dice nada a una
  // ferretería.
  namePlaceholder: string;
  icon: string;
  // Con qué se representa a quien atiende y al catálogo en las pantallas. Una
  // barbería se reconoce en unas tijeras; una verdulería, no.
  staffIcon: string;
  catalogIcon: string;
  // Módulos que vienen prendidos al crear el negocio.
  modules: AppModule[];
  features: VerticalFeatures;
  labels: VerticalLabels;
  categories: string[];
  catalog: SeedProduct[];
};

// Etiquetas por defecto: rubro de comercio genérico que vende productos.
const RETAIL_LABELS: VerticalLabels = {
  catalogSingular: "Producto",
  catalogPlural: "Productos",
  catalogHint: "Catálogo, precios y códigos",
  staffSingular: "Vendedor",
  staffPlural: "Vendedores",
  staffHint: "Alta, sucursal y PIN",
  sellAction: "Vender",
  saleSingular: "Venta",
  salePlural: "Ventas",
};

// Los módulos que casi todo comercio con mercadería necesita.
const RETAIL_MODULES: AppModule[] = [
  AppModule.CASH,
  AppModule.EXPENSES,
  AppModule.STOCK,
  AppModule.SUPPLIERS,
  AppModule.PROMOTIONS,
  AppModule.CUSTOMERS,
  AppModule.MARKETING,
];

export const VERTICAL_PRESETS: Record<Vertical, VerticalPreset> = {
  [Vertical.BARBERSHOP]: {
    vertical: Vertical.BARBERSHOP,
    label: "Barbería o peluquería",
    tagline: "Cobrás por servicio, cada barbero con su terminal y su comisión.",
    namePlaceholder: "Ej: Barbería Don Julio",
    icon: "solar:scissors-bold",
    staffIcon: "solar:scissors-bold",
    catalogIcon: "solar:scissors-bold",
    modules: [
      AppModule.APPOINTMENTS,
      AppModule.CASH,
      AppModule.EXPENSES,
      AppModule.TERMINALS,
      AppModule.STAFF_COMMISSIONS,
      AppModule.INVOICING,
      AppModule.STOCK,
      AppModule.MARKETING,
    ],
    features: SERVICE_FEATURES,
    labels: {
      catalogSingular: "Servicio",
      catalogPlural: "Servicios",
      catalogHint: "Catálogo y precios por sucursal",
      staffSingular: "Barbero",
      staffPlural: "Barberos",
      staffHint: "Alta, sucursal y PIN",
      sellAction: "Cobrar",
      saleSingular: "Venta",
      salePlural: "Ventas",
    },
    categories: ["Cortes", "Barba", "Color", "Productos"],
    catalog: [
      { name: "Corte clásico", price: 9000, category: "Cortes" },
      { name: "Corte y barba", price: 14500, category: "Cortes" },
      { name: "Perfilado de barba", price: 6500, category: "Barba" },
      { name: "Color express", price: 18000, category: "Color" },
      { name: "Cera modeladora", price: 7000, category: "Productos", kind: ProductKind.GOOD, cost: 4200, stock: 12 },
      { name: "Shampoo", price: 9500, category: "Productos", kind: ProductKind.GOOD, cost: 5800, stock: 8 },
    ],
  },

  [Vertical.BEAUTY]: {
    vertical: Vertical.BEAUTY,
    label: "Estética, uñas o spa",
    tagline: "Servicios con turno, productos de reventa y comisiones.",
    namePlaceholder: "Ej: Estética Bella",
    icon: "solar:magic-stick-3-bold",
    staffIcon: "solar:magic-stick-3-bold",
    catalogIcon: "solar:magic-stick-3-bold",
    modules: [
      AppModule.APPOINTMENTS,
      AppModule.CASH,
      AppModule.EXPENSES,
      AppModule.STAFF_COMMISSIONS,
      AppModule.CUSTOMERS,
      AppModule.INVOICING,
      AppModule.STOCK,
      AppModule.MARKETING,
    ],
    features: SERVICE_FEATURES,
    labels: {
      catalogSingular: "Servicio",
      catalogPlural: "Servicios",
      catalogHint: "Catálogo y precios por sucursal",
      staffSingular: "Especialista",
      staffPlural: "Especialistas",
      staffHint: "Alta, sucursal y PIN",
      sellAction: "Cobrar",
      saleSingular: "Venta",
      salePlural: "Ventas",
    },
    categories: ["Manos y pies", "Tratamientos", "Depilación", "Productos"],
    catalog: [
      { name: "Semipermanente", price: 12000, category: "Manos y pies" },
      { name: "Kapping gel", price: 16000, category: "Manos y pies" },
      { name: "Limpieza facial", price: 20000, category: "Tratamientos" },
      { name: "Depilación media pierna", price: 9000, category: "Depilación" },
      { name: "Crema de manos", price: 8500, category: "Productos", kind: ProductKind.GOOD, cost: 5000, stock: 10 },
    ],
  },

  [Vertical.CLOTHING]: {
    vertical: Vertical.CLOTHING,
    label: "Local de ropa",
    tagline: "Stock por prenda, promos de temporada y cambios.",
    namePlaceholder: "Ej: Ropa Almacén 21",
    icon: "solar:t-shirt-bold",
    staffIcon: "solar:users-group-rounded-bold",
    catalogIcon: "solar:t-shirt-bold",
    modules: [...RETAIL_MODULES, AppModule.INVOICING],
    features: { variants: true, barcodes: true, packs: false, goods: true, publicPage: "catalog" },
    labels: RETAIL_LABELS,
    categories: ["Remeras", "Pantalones", "Camperas", "Calzado", "Accesorios"],
    catalog: [
      { name: "Remera lisa", price: 18000, category: "Remeras", kind: ProductKind.GOOD, cost: 9000, stock: 20 },
      { name: "Jean clásico", price: 45000, category: "Pantalones", kind: ProductKind.GOOD, cost: 24000, stock: 12 },
      { name: "Campera de abrigo", price: 89000, category: "Camperas", kind: ProductKind.GOOD, cost: 48000, stock: 6 },
      { name: "Zapatilla urbana", price: 72000, category: "Calzado", kind: ProductKind.GOOD, cost: 40000, stock: 8 },
      { name: "Gorra", price: 15000, category: "Accesorios", kind: ProductKind.GOOD, cost: 7000, stock: 15 },
    ],
  },

  [Vertical.KIOSK]: {
    vertical: Vertical.KIOSK,
    label: "Kiosco o drugstore",
    tagline: "Venta rápida por código de barras, fiado y reposición.",
    namePlaceholder: "Ej: Kiosco El Rulo",
    icon: "solar:cup-hot-bold",
    staffIcon: "solar:users-group-rounded-bold",
    catalogIcon: "solar:cup-hot-bold",
    modules: RETAIL_MODULES,
    features: RESTOCK_FEATURES,
    labels: RETAIL_LABELS,
    categories: ["Golosinas", "Bebidas", "Cigarrillos", "Snacks", "Almacén"],
    catalog: [
      { name: "Alfajor triple", price: 1800, category: "Golosinas", kind: ProductKind.GOOD, cost: 1100, stock: 40 },
      { name: "Chicles", price: 900, category: "Golosinas", kind: ProductKind.GOOD, cost: 500, stock: 60 },
      { name: "Gaseosa 500 ml", price: 2200, category: "Bebidas", kind: ProductKind.GOOD, cost: 1400, stock: 36 },
      { name: "Agua saborizada 1,5 L", price: 2800, category: "Bebidas", kind: ProductKind.GOOD, cost: 1800, stock: 24 },
      { name: "Papas fritas", price: 3200, category: "Snacks", kind: ProductKind.GOOD, cost: 2000, stock: 30 },
      { name: "Atado de cigarrillos", price: 4500, category: "Cigarrillos", kind: ProductKind.GOOD, cost: 3600, stock: 25 },
    ],
  },

  [Vertical.GROCERY]: {
    vertical: Vertical.GROCERY,
    label: "Verdulería o fiambrería",
    tagline: "Venta por peso, merma y cuentas de proveedores.",
    namePlaceholder: "Ej: Verdulería La Huerta",
    icon: "solar:leaf-bold",
    staffIcon: "solar:users-group-rounded-bold",
    catalogIcon: "solar:leaf-bold",
    modules: RETAIL_MODULES,
    features: RESTOCK_FEATURES,
    labels: RETAIL_LABELS,
    categories: ["Frutas", "Verduras", "Aromáticas", "Almacén", "Huevos y lácteos"],
    catalog: [
      { name: "Banana", price: 2400, category: "Frutas", kind: ProductKind.GOOD, unit: Unit.KG, cost: 1500, stock: 30 },
      { name: "Manzana roja", price: 3200, category: "Frutas", kind: ProductKind.GOOD, unit: Unit.KG, cost: 2000, stock: 25 },
      { name: "Tomate", price: 2900, category: "Verduras", kind: ProductKind.GOOD, unit: Unit.KG, cost: 1700, stock: 20 },
      { name: "Papa", price: 1600, category: "Verduras", kind: ProductKind.GOOD, unit: Unit.KG, cost: 900, stock: 50 },
      { name: "Lechuga", price: 1800, category: "Verduras", kind: ProductKind.GOOD, cost: 1000, stock: 18 },
      { name: "Huevos por docena", price: 5200, category: "Huevos y lácteos", kind: ProductKind.GOOD, unit: Unit.DOZEN, cost: 3800, stock: 15 },
    ],
  },

  [Vertical.HABERDASHERY]: {
    vertical: Vertical.HABERDASHERY,
    label: "Mercería o bazar",
    tagline: "Venta por metro, mucho artículo chico y cuentas a pagar.",
    namePlaceholder: "Ej: Mercería La Aguja",
    icon: "solar:notebook-bookmark-bold",
    staffIcon: "solar:users-group-rounded-bold",
    catalogIcon: "solar:notebook-bookmark-bold",
    modules: [...RETAIL_MODULES, AppModule.INVOICING, AppModule.QUOTES],
    features: { ...RESTOCK_FEATURES, publicPage: "catalog" },
    labels: RETAIL_LABELS,
    categories: ["Hilos y lanas", "Cintas y elásticos", "Botones", "Telas", "Herramientas"],
    catalog: [
      { name: "Ovillo de lana", price: 6500, category: "Hilos y lanas", kind: ProductKind.GOOD, cost: 3900, stock: 30 },
      { name: "Hilo de coser", price: 1900, category: "Hilos y lanas", kind: ProductKind.GOOD, cost: 1100, stock: 60 },
      { name: "Cinta de raso", price: 1200, category: "Cintas y elásticos", kind: ProductKind.GOOD, unit: Unit.METER, cost: 700, stock: 80 },
      { name: "Elástico 2 cm", price: 900, category: "Cintas y elásticos", kind: ProductKind.GOOD, unit: Unit.METER, cost: 500, stock: 100 },
      { name: "Botón nacarado", price: 400, category: "Botones", kind: ProductKind.GOOD, cost: 200, stock: 200 },
      { name: "Tela de algodón", price: 8900, category: "Telas", kind: ProductKind.GOOD, unit: Unit.METER, cost: 5400, stock: 45 },
    ],
  },

  [Vertical.HARDWARE]: {
    vertical: Vertical.HARDWARE,
    label: "Ferretería o corralón",
    tagline: "Mucho SKU, venta por metro o kilo y cuenta corriente.",
    namePlaceholder: "Ej: Ferretería El Tornillo",
    icon: "solar:sledgehammer-bold",
    staffIcon: "solar:users-group-rounded-bold",
    catalogIcon: "solar:sledgehammer-bold",
    modules: [...RETAIL_MODULES, AppModule.INVOICING, AppModule.QUOTES],
    features: { ...RESTOCK_FEATURES, publicPage: "catalog" },
    labels: RETAIL_LABELS,
    categories: ["Herramientas", "Electricidad", "Plomería", "Ferretería general", "Pinturería"],
    catalog: [
      { name: "Martillo carpintero", price: 18000, category: "Herramientas", kind: ProductKind.GOOD, cost: 11000, stock: 10 },
      { name: "Cable unipolar 2,5 mm", price: 2200, category: "Electricidad", kind: ProductKind.GOOD, unit: Unit.METER, cost: 1400, stock: 200 },
      { name: "Rollo de teflón", price: 1500, category: "Plomería", kind: ProductKind.GOOD, cost: 800, stock: 50 },
      { name: "Tornillo autoperforante", price: 150, category: "Ferretería general", kind: ProductKind.GOOD, cost: 80, stock: 500 },
      { name: "Látex interior 4 L", price: 32000, category: "Pinturería", kind: ProductKind.GOOD, cost: 21000, stock: 12 },
    ],
  },

  [Vertical.BAKERY]: {
    vertical: Vertical.BAKERY,
    label: "Panadería o pastelería",
    tagline: "Mostrador y salón: tomás el pedido en la mesa, la cocina lo prepara y cobrás al final.",
    namePlaceholder: "Ej: Panadería La Espiga",
    icon: "solar:chef-hat-bold",
    staffIcon: "solar:users-group-rounded-bold",
    catalogIcon: "solar:donut-bitten-bold",
    // A lo de cualquier comercio con mercadería se le suman los tres de
    // gastronomía: acá la venta arranca antes del cobro.
    modules: [...RETAIL_MODULES, AppModule.TABLES, AppModule.KITCHEN, AppModule.RECIPES],
    // Se escanea y se repone por bulto (la docena de facturas), pero no hay
    // talles. Y se encarga una torta por link, así que la página es catálogo.
    features: { ...RESTOCK_FEATURES, publicPage: "catalog" },
    labels: RETAIL_LABELS,
    categories: ["Panes", "Facturas", "Pastelería", "Bebidas"],
    // Con foto: en un mostrador se vende mirando, no leyendo una lista. El POS
    // ya sabe mostrarlas (ver posImageSrc); sin `catalogSlug` quedaban en texto.
    catalog: [
      { name: "Pan de Queso", price: 420, category: "Panes", kind: ProductKind.GOOD, cost: 126, stock: 40 , catalogSlug: "pan-de-queso" },
      { name: "Milonguita", price: 1400, category: "Panes", kind: ProductKind.GOOD, cost: 420, stock: 30 , catalogSlug: "milonguita" },
      { name: "Pan Del Abuelo", price: 2800, category: "Panes", kind: ProductKind.GOOD, cost: 840, stock: 20 , catalogSlug: "pan-del-abuelo" },
      { name: "Medialuna", price: 630, category: "Facturas", kind: ProductKind.GOOD, cost: 202, stock: 60 , catalogSlug: "medialuna" },
      { name: "Docena de medialunas", price: 7000, category: "Facturas", kind: ProductKind.GOOD, unit: Unit.DOZEN, cost: 2420, stock: 10 , catalogSlug: "docena-de-medialunas" },
      { name: "Cremona", price: 1500, category: "Facturas", kind: ProductKind.GOOD, cost: 480, stock: 25 , catalogSlug: "cremona" },
      { name: "Alfajor de Maicena", price: 9520, category: "Pastelería", kind: ProductKind.GOOD, cost: 3332, stock: 15 , catalogSlug: "alfajor-de-maicena" },
      { name: "Pepas de Membrillo", price: 8960, category: "Pastelería", kind: ProductKind.GOOD, cost: 3136, stock: 12 , catalogSlug: "pepas-de-membrillo" },
      { name: "Americano", price: 5290, category: "Bebidas", kind: ProductKind.GOOD, cost: 1323, stock: 0 , catalogSlug: "cafe-americano" },
      { name: "Capuccino", price: 6350, category: "Bebidas", kind: ProductKind.GOOD, cost: 1588, stock: 0 , catalogSlug: "capuccino" },
    ],
  },

  [Vertical.GENERAL]: {
    vertical: Vertical.GENERAL,
    label: "Otro comercio",
    tagline: "Arrancá con lo básico y prendé los módulos que necesites.",
    namePlaceholder: "Ej: Mi comercio",
    icon: "solar:shop-2-bold",
    staffIcon: "solar:users-group-rounded-bold",
    catalogIcon: "solar:box-bold",
    modules: [AppModule.CASH, AppModule.EXPENSES, AppModule.STOCK, AppModule.MARKETING],
    features: { variants: false, barcodes: true, packs: false, goods: true, publicPage: null },
    labels: RETAIL_LABELS,
    categories: ["General"],
    catalog: [],
  },
};

// Orden en que se ofrecen los rubros en el onboarding: primero los que ya
// tenemos validados, "Otro comercio" siempre al final.
export const VERTICAL_ORDER: Vertical[] = [
  Vertical.BARBERSHOP,
  Vertical.KIOSK,
  Vertical.GROCERY,
  Vertical.CLOTHING,
  Vertical.HABERDASHERY,
  Vertical.BEAUTY,
  Vertical.HARDWARE,
  Vertical.BAKERY,
  Vertical.GENERAL,
];

export function verticalPreset(vertical: Vertical): VerticalPreset {
  return VERTICAL_PRESETS[vertical] ?? VERTICAL_PRESETS[Vertical.GENERAL];
}

export function verticalLabels(vertical: Vertical): VerticalLabels {
  return verticalPreset(vertical).labels;
}

// Rubro por defecto cuando todavía no se sabe cuál es (ej: render de una
// pantalla pública o un negocio viejo sin rubro cargado).
export const DEFAULT_LABELS = RETAIL_LABELS;

export function isVertical(value: string): value is Vertical {
  return Object.values(Vertical).includes(value as Vertical);
}
