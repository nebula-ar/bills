import { AppModule } from "@/generated/prisma/enums";

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
    hint: "Compras, vencimientos y deuda",
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
    hint: "Qué se gastó y de qué cuenta salió",
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
    hint: "Agenda del día y cobro en la silla",
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
];

export function isAppModule(value: string): value is AppModule {
  return Object.values(AppModule).includes(value as AppModule);
}

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
): Nav {
  const has = (module: AppModule) => modules.has(module);

  const primary: NavPrimary[] = [
    { href: "/", label: "Inicio", icon: "solar:home-2-bold" },
    // Vender arranca en /pos (elegir caja) y sigue en /sales/new (el checkout):
    // las dos son "vender", así que el ítem queda marcado en ambas.
    { href: "/pos", label: labels.sellAction, icon: "solar:bag-4-bold", alsoMatches: ["/sales/new"] },
    // Historial es /sales, pero NO /sales/new: ahí el usuario está vendiendo.
    { href: "/sales", label: "Historial", icon: "solar:bill-list-bold", exact: true },
    // Cuarto lugar: el catálogo. Es la pantalla donde el dueño carga lo que
    // vende Y maneja su existencia (todo lo de un producto se resuelve en su
    // ficha), así que es lo que más toca después de vender. Stock quedó para lo
    // de conjunto —faltantes, movimientos, traspasos— y vive en "Más".
    { href: "/catalog", label: labels.catalogPlural, icon: catalogIcon },
  ];

  const more: NavEntry[] = [];
  const push = (module: AppModule, href: string, overrides?: Partial<NavEntry>) => {
    if (!has(module)) return;
    const info = MODULE_INFO[module];
    more.push({ href, label: info.label, icon: info.icon, tint: info.tint, hint: info.hint, ...overrides });
  };

  // Los módulos operativos primero; los ABM de configuración, al final.
  push(AppModule.STOCK, "/stock", { hint: "Faltantes, movimientos y traspasos" });
  push(AppModule.APPOINTMENTS, "/turnos");
  push(AppModule.SUPPLIERS, "/suppliers");
  push(AppModule.PROMOTIONS, "/promotions");
  push(AppModule.MARKETING, "/marketing");
  push(AppModule.QUOTES, "/presupuestos");
  push(AppModule.CUSTOMERS, "/customers");
  push(AppModule.CASH, "/caja");
  push(AppModule.EXPENSES, "/expenses");

  more.push({
    href: "/staff",
    label: labels.staffPlural,
    icon: "solar:users-group-two-rounded-bold",
    tint: "orange",
    hint: labels.staffHint,
  });
  more.push({
    href: "/branches",
    label: "Sucursales",
    icon: "solar:shop-2-bold",
    tint: "rose",
    hint: "Nombre, dirección y estado",
  });

  push(AppModule.STAFF_COMMISSIONS, "/comisiones");
  push(AppModule.TERMINALS, "/terminals");
  push(AppModule.INVOICING, "/facturacion");

  // Sin módulo que la gobierne: todo negocio le tiene que dar algo al contador.
  more.push({
    href: "/exportar",
    label: "Exportar",
    icon: "solar:file-download-bold",
    tint: "cyan",
    hint: "Planillas de ventas, gastos y compras",
  });
  more.push({
    href: "/settings",
    label: "Módulos",
    icon: "solar:widget-add-bold",
    tint: "blue",
    hint: "Prendé o apagá funciones del sistema",
  });

  return { primary, more };
}
