import { AppModule, UserRole } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";

import { buildNav } from "./app-modules";
import { capabilitiesOf } from "./capabilities";
import { VERTICAL_PRESETS } from "./vertical";
import { Vertical } from "@/generated/prisma/enums";

/**
 * La navegación se arma en el servidor y viaja al cliente ya lista. Filtrar
 * acá no es cosmética: lo que no se manda, no se puede tocar desde el celular
 * de nadie.
 *
 * Igual esto NO reemplaza los guards del servidor. Esconder un link deja la
 * ruta viva para quien la escriba a mano; los dos controles tienen que existir
 * y salir de la misma fuente (`capabilities.ts`).
 */

const LABELS = VERTICAL_PRESETS[Vertical.BAKERY].labels;
const TODOS_LOS_MODULOS = new Set(Object.values(AppModule));

function navPara(rol: UserRole) {
  return buildNav(LABELS, TODOS_LOS_MODULOS, "solar:donut-bitten-bold", capabilitiesOf(rol));
}

/** Todos los destinos que el rol puede ver, primarios y de "Más". */
function destinos(rol: UserRole): string[] {
  const nav = navPara(rol);
  return [...nav.primary.map((e) => e.href), ...nav.more.map((e) => e.href)];
}

describe("el dueño ve todo", () => {
  it("con todos los módulos prendidos, no le falta ninguna pantalla", () => {
    const suyos = destinos(UserRole.OWNER);

    expect(suyos).toContain("/dashboard");
    expect(suyos).toContain("/pos");
    expect(suyos).toContain("/sales");
    expect(suyos).toContain("/staff");
    expect(suyos).toContain("/branches");
    expect(suyos).toContain("/settings");
  });
});

describe("lo que cada rol NO recibe", () => {
  it("el cocinero no recibe ninguna pantalla de gestión", () => {
    // Su tablet queda abierta en la cocina, sin nadie mirando.
    const suyos = destinos(UserRole.COOK);

    for (const prohibido of ["/dashboard", "/pos", "/sales", "/staff", "/branches", "/expenses", "/settings"]) {
      expect(suyos, `el cocinero no debería ver ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("el mozo no recibe ni el cobro ni el historial", () => {
    const suyos = destinos(UserRole.WAITER);

    expect(suyos).not.toContain("/pos");
    expect(suyos).not.toContain("/sales");
    expect(suyos).not.toContain("/dashboard");
  });

  it("el cajero cobra y arquea, pero no ve los números del negocio", () => {
    const suyos = destinos(UserRole.CASHIER);

    expect(suyos).toContain("/pos");
    expect(suyos).toContain("/sales");
    expect(suyos).toContain("/caja");

    // Inicio es el panel: facturación y márgenes.
    expect(suyos).not.toContain("/dashboard");
    expect(suyos).not.toContain("/expenses");
    expect(suyos).not.toContain("/staff");
  });

  it("el encargado maneja el local pero no da de alta gente ni sucursales", () => {
    const suyos = destinos(UserRole.MANAGER);

    expect(suyos).toContain("/dashboard");
    expect(suyos).toContain("/expenses");
    expect(suyos).toContain("/stock");

    expect(suyos).not.toContain("/staff");
    expect(suyos).not.toContain("/branches");
    expect(suyos).not.toContain("/settings");
  });
});

describe("no romper lo que ya andaba", () => {
  it("sin capacidades declaradas, la nav sale igual que antes", () => {
    // La firma nueva es opcional a propósito: llamarla como antes tiene que
    // seguir devolviendo la nav completa, o rompe todo lo que ya la usa.
    const conParametro = buildNav(LABELS, TODOS_LOS_MODULOS, "solar:donut-bitten-bold");
    const dueño = navPara(UserRole.OWNER);

    expect(conParametro.primary.map((e) => e.href)).toEqual(dueño.primary.map((e) => e.href));
    expect(conParametro.more.map((e) => e.href)).toEqual(dueño.more.map((e) => e.href));
  });

  it("un módulo apagado no aparece aunque el rol tenga la capacidad", () => {
    // El filtro por rol se SUMA al de módulos, no lo reemplaza: un negocio que
    // no usa caja no le muestra caja ni al dueño.
    const sinCaja = new Set(Object.values(AppModule).filter((m) => m !== AppModule.CASH));
    const nav = buildNav(LABELS, sinCaja, "solar:donut-bitten-bold", capabilitiesOf(UserRole.OWNER));

    expect(nav.more.map((e) => e.href)).not.toContain("/caja");
  });
});
