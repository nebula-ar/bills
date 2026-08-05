import { AppModule } from "@/generated/prisma/enums";

import type { Capability } from "./capabilities";

import type { VerticalLabels } from "./vertical";

// Metadata de presentación de cada módulo: cómo se llama, qué icono lleva y
// para qué sirve. Vive acá (y no en la nav) para que el onboarding, la pantalla
// de configuración y la navegación describan los módulos igual.

export type ModuleInfo = {
  module: AppModule;
  label: string;
  hint: string;
  icon: string;
  tint: ModuleTint;
};

export type ModuleTint = "emerald" | "blue" | "violet" | "orange" | "rose" | "cyan" | "amber" | "indigo";

export const MODULE_INFO: Record<AppModule, ModuleInfo> = {
  [AppModule.STOCK]: {
    module: AppModule.STOCK,
    label: "Stock",
    hint: "Faltantes, movimientos y traspasos",
    icon: "solar:box-bold",
    tint: "amber",
  },
  [AppModule.SUPPLIERS]: {
    module: AppModule.SUPPLIERS,
    label: "Proveedores",
    // No tiene pantalla propia: una compra es plata que sale, así que vive
    // dentro de Gastos. Prender esto le agrega a Gastos las facturas, la deuda
    // y los vencimientos (ver MODULE_REQUIRES).
    hint: "Facturas, deuda y vencimientos, dentro de Gastos",
    icon: "solar:delivery-bold",
    tint: "indigo",
  },
  [AppModule.PROMOTIONS]: {
    module: AppModule.PROMOTIONS,
    label: "Promociones",
    hint: "Descuentos, 2x1 y combos",
    icon: "solar:tag-price-bold",
    tint: "rose",
  },
  [AppModule.CUSTOMERS]: {
    module: AppModule.CUSTOMERS,
    label: "Clientes",
    hint: "Ficha, historial y cuenta corriente",
    icon: "solar:users-group-rounded-bold",
    tint: "violet",
  },
  [AppModule.CASH]: {
    module: AppModule.CASH,
    label: "Caja",
    hint: "Saldos, transferencias y cierre de caja",
    icon: "solar:safe-2-bold",
    tint: "emerald",
  },
  [AppModule.EXPENSES]: {
    module: AppModule.EXPENSES,
    label: "Gastos",
    hint: "Todo lo que sale: gastos y compras a proveedores",
    icon: "solar:wallet-bold",
    tint: "orange",
  },
  [AppModule.INVOICING]: {
    module: AppModule.INVOICING,
    label: "Facturación",
    hint: "CUIT, condición IVA y comprobantes AFIP",
    icon: "solar:bill-check-bold",
    tint: "cyan",
  },
  [AppModule.TERMINALS]: {
    module: AppModule.TERMINALS,
    label: "Terminales",
    hint: "Mostrador, teléfonos y propias",
    icon: "solar:smartphone-bold",
    tint: "blue",
  },
  [AppModule.APPOINTMENTS]: {
    module: AppModule.APPOINTMENTS,
    label: "Turnos",
    hint: "Agenda del día y cobro de servicios",
    icon: "solar:calendar-bold",
    tint: "violet",
  },
  [AppModule.MARKETING]: {
    module: AppModule.MARKETING,
    label: "Marketing",
    hint: "Recuperar clientes, cumpleaños, puntos y tu página pública",
    icon: "solar:user-heart-bold",
    tint: "orange",
  },
  [AppModule.QUOTES]: {
    module: AppModule.QUOTES,
    label: "Presupuestos",
    hint: "Cotizar, compartir y convertir en venta",
    icon: "solar:document-text-bold",
    tint: "cyan",
  },
  [AppModule.STAFF_COMMISSIONS]: {
    module: AppModule.STAFF_COMMISSIONS,
    label: "Comisiones",
    hint: "Porcentaje por empleado sobre lo vendido",
    icon: "solar:hand-money-bold",
    tint: "emerald",
  },
  [AppModule.TABLES]: {
    module: AppModule.TABLES,
    label: "Salón",
    hint: "Sectores, mesas y comandas",
    icon: "solar:cup-hot-bold",
    tint: "orange",
  },
  [AppModule.KITCHEN]: {
    module: AppModule.KITCHEN,
    label: "Cocina",
    // No es una pantalla de gestión: es la que mira el cocinero mientras
    // trabaja, con lo que falta preparar y hace cuánto que espera.
    hint: "Qué preparar y en qué orden",
    icon: "solar:chef-hat-bold",
    tint: "rose",
  },
  [AppModule.RECIPES]: {
    module: AppModule.RECIPES,
    label: "Recetas",
    hint: "Qué ingrediente consume cada producto, producción y mermas",
    icon: "solar:cookbook-bold",
    tint: "amber",
  },
};

// Los módulos que el dueño puede prender y apagar desde configuración, en el
// orden en que se le muestran.
export const CONFIGURABLE_MODULES: AppModule[] = [
  AppModule.APPOINTMENTS,
  AppModule.STOCK,
  AppModule.SUPPLIERS,
  AppModule.PROMOTIONS,
  AppModule.MARKETING,
  AppModule.QUOTES,
  AppModule.CUSTOMERS,
  AppModule.CASH,
  AppModule.EXPENSES,
  AppModule.INVOICING,
  AppModule.TERMINALS,
  AppModule.STAFF_COMMISSIONS,
  AppModule.TABLES,
  AppModule.KITCHEN,
  AppModule.RECIPES,
];

export function isAppModule(value: string): value is AppModule {
  return Object.values(AppModule).includes(value as AppModule);
}

// Módulos que no se sostienen solos porque viven dentro de otra pantalla.
// Proveedores es el caso: sin Gastos no hay dónde entrar a las facturas, y
// prenderlo dejaría un módulo activo sin puerta.
export const MODULE_REQUIRES: Partial<Record<AppModule, AppModule>> = {
  [AppModule.SUPPLIERS]: AppModule.EXPENSES,
  // La cocina muestra comandas: sin mesas no hay comanda que mostrar y la
  // pantalla quedaría vacía para siempre.
  [AppModule.KITCHEN]: AppModule.TABLES,
  // Una receta descuenta ingredientes del stock. Sin stock no hay de dónde.
  [AppModule.RECIPES]: AppModule.STOCK,
};

// ─────────────────────────────────────────────────────────────────────────────
// Navegación
// ─────────────────────────────────────────────────────────────────────────────

export type NavEntry = {
  href: string;
  label: string;
  icon: string;
  tint: ModuleTint;
  hint: string;
};

export type NavPrimary = {
  href: string;
  label: string;
  icon: string;
  // Rutas extra que también dejan este ítem marcado como activo, y rutas que NO
  // deben marcarlo aunque cuelguen de su href (ver `exact`).
  alsoMatches?: string[];
  // Solo se marca activo en esta ruta exacta, no en sus hijas.
  exact?: boolean;
};

export type Nav = {
  // Barra inferior (siempre 4 + el botón "Más").
  primary: NavPrimary[];
  // Detrás de "Más": el resto de los módulos y la configuración.
  more: NavEntry[];
};

// Arma la navegación a partir del rubro (labels) y de los módulos prendidos.
// Un módulo apagado no aparece: la app se ve tan chica como el negocio la usa.
export function buildNav(
  labels: VerticalLabels,
  modules: ReadonlySet<AppModule>,
  // Icono del rubro para el catálogo (ver src/lib/vertical.ts).
  catalogIcon = "solar:clipboard-list-bold",
  // Qué puede hacer quien mira (ver src/lib/capabilities.ts). Sin esto se
  // arma la nav completa: los llamados viejos siguen andando igual.
  //
  // Filtrar acá no es cosmética —lo que no se manda no se toca desde el
  // celular de nadie— pero TAMPOCO reemplaza los guards del servidor:
  // esconder el link deja la ruta viva para quien la escriba a mano.
  capabilities?: readonly Capability[],
): Nav {
  const has = (module: AppModule) => modules.has(module);
  // `undefined` = sin filtrar. Un array vacío sí filtra: un rol sin
  // capacidades no ve nada, que es lo correcto.
  const puede = (cap: Capability) => capabilities === undefined || capabilities.includes(cap);

  const primary: NavPrimary[] = ([] as (NavPrimary & { cap: Capability })[]).concat([
    // Apunta al panel, no a "/". La raíz desvía al "¿panel o vender?", que es
    // una pregunta DE ENTRADA: quien ya está trabajando y toca Inicio quiere
    // ver su día, no que le vuelvan a preguntar a dónde iba.
    { href: "/dashboard", label: "Inicio", icon: "solar:home-2-bold", exact: true, cap: "viewReports" },
    // Vender arranca en /pos (elegir caja) y sigue en /sales/new (el checkout):
    // las dos son "vender", así que el ítem queda marcado en ambas.
    { href: "/pos", label: labels.sellAction, icon: "solar:bag-4-bold", alsoMatches: ["/sales/new"], cap: "sell" },
    // Historial es /sales, pero NO /sales/new: ahí el usuario está vendiendo.
    { href: "/sales", label: "Historial", icon: "solar:bill-list-bold", exact: true, cap: "viewSales" },
    // Cuarto lugar: el catálogo. Es la pantalla donde el dueño carga lo que
    // vende Y maneja su existencia (todo lo de un producto se resuelve en su
    // ficha), así que es lo que más toca después de vender. Stock quedó para lo
    // de conjunto —faltantes, movimientos, traspasos— y vive en "Más".
    { href: "/catalog", label: labels.catalogPlural, icon: catalogIcon, cap: "manageCatalog" },
  ]).filter((e) => puede(e.cap));

  const more: NavEntry[] = [];
  const push = (module: AppModule, href: string, cap: Capability, overrides?: Partial<NavEntry>) => {
    // Los dos filtros se suman: el módulo dice si el NEGOCIO lo usa, la
    // capacidad si esta PERSONA puede. Un negocio sin caja no le muestra caja
    // ni al dueño; un cocinero no ve gastos aunque el negocio los use.
    if (!has(module) || !puede(cap)) return;
    const info = MODULE_INFO[module];
    more.push({ href, label: info.label, icon: info.icon, tint: info.tint, hint: info.hint, ...overrides });
  };

  // Los módulos operativos primero; los ABM de configuración, al final.
  push(AppModule.STOCK, "/stock", "manageStock", { hint: "Faltantes, movimientos y traspasos" });
  push(AppModule.TABLES, "/salon", "waitTables");
  push(AppModule.KITCHEN, "/cocina", "kitchen");
  push(AppModule.TABLES, "/opciones", "manageCatalog", { label: "Opciones", hint: "Los extras que hoy se regalan" });
  push(AppModule.RECIPES, "/recetas", "manageRecipes");
  push(AppModule.RECIPES, "/produccion", "manageRecipes", { label: "Producción", hint: "Registrás la tanda y se descuentan los insumos" });
  push(AppModule.RECIPES, "/mermas", "manageRecipes", { label: "Mermas", hint: "Lo quemado, roto o vencido" });
  push(AppModule.APPOINTMENTS, "/turnos", "sell");
  push(AppModule.PROMOTIONS, "/promotions", "manageCatalog");
  push(AppModule.MARKETING, "/marketing", "manageBusiness");
  push(AppModule.QUOTES, "/presupuestos", "sell");
  push(AppModule.CUSTOMERS, "/customers", "manageCustomers");
  push(AppModule.CASH, "/caja", "cashRegister");
  // Proveedores no tiene entrada propia: entra por acá. Que el dueño no tenga
  // que decidir si lo que le pagó al distribuidor es "un gasto" o "una compra"
  // para saber en qué pantalla buscarlo.
  push(AppModule.EXPENSES, "/expenses", "manageExpenses", {
    hint: has(AppModule.SUPPLIERS) ? "Gastos, facturas de proveedor y vencimientos" : MODULE_INFO[AppModule.EXPENSES].hint,
  });

  if (puede("manageTeam")) more.push({
    href: "/staff",
    label: labels.staffPlural,
    icon: "solar:users-group-two-rounded-bold",
    tint: "orange",
    hint: labels.staffHint,
  });
  if (puede("manageBranches")) more.push({
    href: "/branches",
    label: "Sucursales",
    icon: "solar:shop-2-bold",
    tint: "rose",
    hint: "Nombre, dirección y estado",
  });

  push(AppModule.STAFF_COMMISSIONS, "/comisiones", "viewReports");
  push(AppModule.TERMINALS, "/terminals", "manageBusiness");
  push(AppModule.INVOICING, "/facturacion", "manageBusiness");

  // Sin módulo que la gobierne: todo negocio le tiene que dar algo al contador.
  if (puede("viewReports")) more.push({
    href: "/exportar",
    label: "Exportar",
    icon: "solar:file-download-bold",
    tint: "cyan",
    hint: "Planillas de ventas, gastos y compras",
  });
  if (puede("manageBusiness")) more.push({
    href: "/settings",
    label: "Módulos",
    icon: "solar:widget-add-bold",
    tint: "blue",
    hint: "Prendé o apagá funciones del sistema",
  });

  return { primary, more };
}
