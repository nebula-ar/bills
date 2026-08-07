import { UserRole } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import { APP_ROLES, CAPABILITIES, ROLE_CAPABILITIES, can, capabilitiesOf } from "./capabilities";

/**
 * Permisos por CAPACIDAD, no por jerarquía lineal.
 *
 * Hasta acá alcanzaba con "admin o no": el dueño veía todo y el empleado
 * vendía por terminal. La gastronomía rompe eso, porque suma roles que
 * comparten rango pero hacen cosas distintas: un mozo y un cocinero no son
 * uno más que el otro, hacen tareas ajenas entre sí. Con una escala lineal
 * hay que elegir cuál está "más arriba", y cualquiera de las dos respuestas
 * le da a alguien algo que no le corresponde.
 *
 * Estos tests cuidan sobre todo lo que NO puede hacer cada rol. Un permiso
 * de más no rompe ninguna pantalla: no se nota hasta que alguien lo usa.
 */

describe("el modelo está completo", () => {
  it("todos los roles tienen sus capacidades declaradas", () => {
    // Sin esto, un rol nuevo entra con permisos indefinidos y `can()` lo
    // trataría como si no pudiera nada, en silencio.
    expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual([...Object.values(UserRole)].sort());
  });

  it("ninguna capacidad declarada queda sin dueño", () => {
    // Una capacidad que nadie tiene es código muerto que igual hay que
    // mantener, o una pantalla a la que nunca se puede entrar.
    const asignadas = new Set(Object.values(ROLE_CAPABILITIES).flat());
    const huerfanas = CAPABILITIES.filter((c) => !asignadas.has(c));

    expect(huerfanas, "capacidades que ningún rol tiene").toEqual([]);
  });
});

describe("quién manda", () => {
  it("dueño y admin pueden todo", () => {
    for (const rol of [UserRole.OWNER, UserRole.ADMIN]) {
      expect(capabilitiesOf(rol).sort(), rol).toEqual([...CAPABILITIES].sort());
    }
  });

  it("el encargado maneja el día a día pero no el negocio", () => {
    // Puede con la operación completa; no da de alta gente ni sucursales, ni
    // toca los datos fiscales. Esa es la línea entre encargado y dueño.
    expect(can(UserRole.MANAGER, "viewReports")).toBe(true);
    expect(can(UserRole.MANAGER, "refund")).toBe(true);
    expect(can(UserRole.MANAGER, "manageStock")).toBe(true);

    expect(can(UserRole.MANAGER, "manageTeam")).toBe(false);
    expect(can(UserRole.MANAGER, "manageBranches")).toBe(false);
    expect(can(UserRole.MANAGER, "manageBusiness")).toBe(false);
  });
});

describe("los roles operativos: lo que NO pueden", () => {
  it("el cocinero solo entra a la cocina", () => {
    // El caso más estricto y el que más importa: la pantalla de cocina suele
    // quedar abierta en una tablet, sin nadie mirando, en un lugar donde
    // entra cualquiera.
    expect(capabilitiesOf(UserRole.COOK)).toEqual(["kitchen"]);
  });

  it("el mozo atiende mesas pero NO cobra", () => {
    // Toma el pedido y lo manda a cocina; la plata la toca el cajero. Es la
    // separación que hace que el arqueo signifique algo.
    expect(can(UserRole.WAITER, "waitTables")).toBe(true);
    expect(can(UserRole.WAITER, "kitchen")).toBe(true);

    expect(can(UserRole.WAITER, "sell")).toBe(false);
    expect(can(UserRole.WAITER, "refund")).toBe(false);
    expect(can(UserRole.WAITER, "viewSales")).toBe(false);
  });

  it("el cajero cobra pero NO anula", () => {
    // Anular es el agujero clásico: se cobra en efectivo, se anula la venta y
    // la caja cierra igual. Por eso vive arriba, con el encargado.
    expect(can(UserRole.CASHIER, "sell")).toBe(true);
    expect(can(UserRole.CASHIER, "cashRegister")).toBe(true);

    expect(can(UserRole.CASHIER, "refund")).toBe(false);
  });

  it("nadie de mostrador ve los números del negocio", () => {
    // Facturación, márgenes y gastos: lo que el dueño no quiere que circule.
    for (const rol of [UserRole.CASHIER, UserRole.WAITER, UserRole.COOK, UserRole.STAFF]) {
      expect(can(rol, "viewReports"), rol).toBe(false);
      expect(can(rol, "manageExpenses"), rol).toBe(false);
      expect(can(rol, "manageTeam"), rol).toBe(false);
      expect(can(rol, "manageBranches"), rol).toBe(false);
    }
  });
});

describe("no romper lo que ya andaba", () => {
  it("el empleado de siempre sigue pudiendo vender", () => {
    // STAFF es el rol que ya existía: vende por terminal. Si la migración le
    // saca eso, deja de andar la app para los negocios de hoy.
    expect(can(UserRole.STAFF, "sell")).toBe(true);
  });

  it("dueño y admin no pierden nada", () => {
    for (const cap of CAPABILITIES) {
      expect(can(UserRole.OWNER, cap), cap).toBe(true);
      expect(can(UserRole.ADMIN, cap), cap).toBe(true);
    }
  });
});

describe("un rol que no se entiende no habilita nada", () => {
  it("null, vacío o basura no pasan", () => {
    // `can()` recibe lo que venga en la sesión. Ante la duda, negar: un
    // fallo abierto acá es una pantalla de gestión servida a cualquiera.
    for (const valor of [null, undefined, "", "SUPERADMIN", "owner"]) {
      expect(can(valor, "sell"), String(valor)).toBe(false);
      expect(can(valor, "viewReports"), String(valor)).toBe(false);
      expect(capabilitiesOf(valor), String(valor)).toEqual([]);
    }
  });
});

describe("quién entra con contraseña y quién con PIN", () => {
  it("los roles que navegan la app entran con contraseña", () => {
    // Sin esto el modelo de capacidades queda decorativo: un mozo con
    // permisos declarados que no puede obtener sesión no sirve de nada.
    for (const rol of [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER, UserRole.COOK]) {
      expect(APP_ROLES, rol).toContain(rol);
    }
  });

  it("el empleado de mostrador NO entra con contraseña: usa el PIN de su terminal", () => {
    // Es como funciona hoy y no se toca: en la base, los STAFF tienen pinHash
    // y passwordHash en null. Sumarlos acá les abriría una puerta que nunca
    // tuvieron.
    expect(APP_ROLES).not.toContain(UserRole.STAFF);
  });

  it("todo rol que puede algo en la app puede entrar a la app", () => {
    // Coherencia: si un rol tiene capacidades pero no puede loguearse, o si
    // puede loguearse y no tiene ninguna, algo quedó a medias.
    for (const rol of APP_ROLES) {
      expect(capabilitiesOf(rol).length, `${rol} entra pero no puede nada`).toBeGreaterThan(0);
    }
  });
});
