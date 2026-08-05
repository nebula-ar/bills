import { UserRole } from "@/generated/prisma/enums";

/**
 * Permisos por CAPACIDAD, no por jerarquía lineal. Única fuente de verdad:
 * la usan tanto la navegación (qué ve cada rol) como los guards del servidor
 * (qué acción puede ejecutar). Sin DB ni React, para poder testearla sola.
 *
 * Hasta la gastronomía alcanzaba con "admin o no": el dueño veía todo y el
 * empleado vendía por terminal. Un mozo y un cocinero rompen esa escala,
 * porque comparten rango pero hacen tareas ajenas: con una jerarquía lineal
 * hay que decidir cuál está más arriba, y cualquiera de las dos respuestas le
 * termina dando a alguien algo que no le corresponde.
 *
 * Ojo con el criterio al asignar: un permiso de más no rompe ninguna pantalla,
 * así que no se nota hasta que alguien lo usa.
 */
export const CAPABILITIES = [
  "sell", // cobrar y registrar la venta
  "waitTables", // abrir comanda, agregar ítems, mover mesas (gastronomía)
  "kitchen", // avanzar la preparación en la pantalla de cocina (gastronomía)
  "refund", // anular ventas y devolver
  "viewSales", // ver el historial de ventas
  "viewReports", // facturación, márgenes y reportes del negocio
  "manageCatalog", // productos, precios y variantes
  "manageStock", // inventario, movimientos y traspasos
  "manageExpenses", // gastos, proveedores y cuentas a pagar
  "manageTeam", // alta de gente, roles y PIN
  "manageBranches", // sucursales
  "manageCustomers", // clientes y cuenta corriente
  "manageRecipes", // recetas, producción y mermas (gastronomía)
  "cashRegister", // abrir y cerrar la caja propia
  "manageBusiness", // datos del negocio: fiscales, terminales, promociones
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const TODAS: Capability[] = [...CAPABILITIES];

/**
 * Qué puede hacer cada rol.
 *
 * Las separaciones que importan, y por qué:
 *
 * - El mozo NO cobra. Toma el pedido y lo manda a cocina; la plata la toca el
 *   cajero. Es lo que hace que el arqueo signifique algo.
 * - El cajero NO anula. Anular es el agujero clásico: se cobra en efectivo, se
 *   anula la venta y la caja cierra igual. Por eso vive con el encargado.
 * - Nadie de mostrador ve reportes. Facturación y márgenes son lo que el dueño
 *   no quiere que circule por el local.
 * - El cocinero solo ve cocina. Esa pantalla queda abierta en una tablet, sin
 *   nadie mirando, en un lugar por donde pasa cualquiera.
 */
export const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  [UserRole.OWNER]: TODAS,
  [UserRole.ADMIN]: TODAS,
  [UserRole.MANAGER]: [
    "sell",
    "waitTables",
    "kitchen",
    "refund",
    "viewSales",
    "viewReports",
    "manageCatalog",
    "manageStock",
    "manageExpenses",
    "manageCustomers",
    "manageRecipes",
    "cashRegister",
  ],
  [UserRole.CASHIER]: ["sell", "waitTables", "viewSales", "cashRegister", "manageCustomers"],
  [UserRole.WAITER]: ["waitTables", "kitchen"],
  [UserRole.COOK]: ["kitchen"],
  // El rol que ya existía: vende por terminal. No se le agrega nada en la
  // migración, para que los negocios de hoy sigan andando igual.
  [UserRole.STAFF]: ["sell"],
};

/**
 * Roles que entran a la app con usuario y contraseña.
 *
 * STAFF queda afuera a propósito y no es un olvido: el empleado de mostrador
 * vende por terminal con un PIN, y en la base sus filas tienen `pinHash` y
 * `passwordHash` en null. Sumarlo acá le abriría una puerta que nunca tuvo.
 *
 * Los roles operativos SÍ entran así: sin esto el modelo de capacidades queda
 * decorativo, porque un mozo con permisos declarados no podría obtener sesión.
 */
export const APP_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.WAITER,
  UserRole.COOK,
];

/**
 * ¿El rol tiene la capacidad?
 *
 * Recibe lo que venga en la sesión, así que ante la duda niega: un fallo
 * abierto acá sirve una pantalla de gestión a cualquiera.
 */
export function can(role: string | null | undefined, cap: Capability): boolean {
  return (ROLE_CAPABILITIES[role as UserRole] ?? []).includes(cap);
}

/** Todas las capacidades de un rol, para la nav o para depurar. */
export function capabilitiesOf(role: string | null | undefined): Capability[] {
  return ROLE_CAPABILITIES[role as UserRole] ?? [];
}
