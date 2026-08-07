import { describe, expect, it } from "vitest";

import {
  MAX_UNIDADES_POR_LINEA,
  motivoParaNoCancelar,
  totalesDeComanda,
  validarCantidad,
  type ComandaLike,
} from "./order-lifecycle";

/**
 * Reglas de la comanda de salón. Todas salen de errores que ya se pagaron en
 * Migas, así que los tests están escritos como recordatorio de qué pasó.
 *
 * La comanda es distinta de una venta de mostrador en una cosa: existe un rato
 * largo antes de cobrarse, y en ese rato la toca gente distinta —el mozo que
 * la abre, la cocina que la prepara, el cajero que la cobra— a veces desde
 * dispositivos distintos y al mismo tiempo.
 */

const vacia: ComandaLike = { itemsEnCocina: 0, pagos: 0 };
const conCocina: ComandaLike = { itemsEnCocina: 3, pagos: 0 };
const conPagos: ComandaLike = { itemsEnCocina: 3, pagos: 1 };

describe("cancelar una comanda", () => {
  it("una comanda vacía la cancela cualquiera que atienda mesas", () => {
    // El caso más común y el que NO hay que trabar: el mozo abrió la mesa por
    // error, o los clientes se fueron antes de pedir. Pedirle permisos
    // especiales para eso lo obliga a buscar al encargado por una pavada.
    expect(motivoParaNoCancelar(vacia, ["waitTables"])).toBeNull();
  });

  it("con ítems en cocina hace falta permiso de anulación", () => {
    // Ya se gastó materia prima: descartarlo es una pérdida que alguien tiene
    // que poder justificar.
    expect(motivoParaNoCancelar(conCocina, ["waitTables"])).toMatch(/cocina|permiso/i);
    expect(motivoParaNoCancelar(conCocina, ["waitTables", "refund"])).toBeNull();
  });

  it("con pagos registrados NO se cancela, ni siendo dueño", () => {
    // Cancelar borraría plata ya cobrada del arqueo. Lo correcto es anular la
    // venta, que deja rastro; cancelar no.
    expect(motivoParaNoCancelar(conPagos, ["waitTables", "refund"])).toBeTruthy();
    expect(motivoParaNoCancelar(conPagos, ["waitTables", "refund", "sell", "viewReports"])).toBeTruthy();
  });

  it("quien no atiende mesas no cancela nada", () => {
    expect(motivoParaNoCancelar(vacia, ["kitchen"])).toBeTruthy();
    expect(motivoParaNoCancelar(vacia, [])).toBeTruthy();
  });
});

describe("cuánto se puede cargar en una línea", () => {
  it("una cantidad normal pasa", () => {
    expect(validarCantidad(0, 2)).toBeNull();
    expect(validarCantidad(10, 5)).toBeNull();
  });

  it("cero o negativo no", () => {
    // Una cantidad negativa era otra forma de bajar el total de la comanda.
    expect(validarCantidad(0, 0)).toBeTruthy();
    expect(validarCantidad(0, -3)).toBeTruthy();
  });

  it("un número absurdo no entra", () => {
    // 9999 medialunas no es un pedido, es un dedo apoyado en el botón o un
    // pedido armado a mano contra el endpoint del QR.
    expect(validarCantidad(0, MAX_UNIDADES_POR_LINEA + 1)).toBeTruthy();
  });

  it("el tope se mide ACUMULADO, no por toque", () => {
    // Si no, se llega al mismo lugar sumando de a uno: el límite por toque no
    // limita nada.
    expect(validarCantidad(MAX_UNIDADES_POR_LINEA, 1)).toBeTruthy();
    expect(validarCantidad(MAX_UNIDADES_POR_LINEA - 1, 1)).toBeNull();
  });

  it("las fracciones no entran en una comanda", () => {
    // Media medialuna no se pide. El salón vende unidades; el peso es de
    // mostrador.
    expect(validarCantidad(0, 1.5)).toBeTruthy();
  });
});

describe("los totales", () => {
  it("suma los renglones", () => {
    const t = totalesDeComanda([{ total: 5290 }, { total: 1400 }, { total: 630 }], 0, 0);

    expect(t.subtotal).toBe(7320);
    expect(t.total).toBe(7320);
  });

  it("la propina suma al total pero NO al subtotal", () => {
    // El subtotal es lo que se vendió; la propina es del mozo. Mezclarlas
    // infla la facturación del negocio con plata que no es suya.
    const t = totalesDeComanda([{ total: 10000 }], 0, 1500);

    expect(t.subtotal).toBe(10000);
    expect(t.total).toBe(11500);
  });

  it("el descuento resta, pero el total nunca queda negativo", () => {
    expect(totalesDeComanda([{ total: 10000 }], 2000, 0).total).toBe(8000);
    expect(totalesDeComanda([{ total: 1000 }], 99999, 0).total).toBe(0);
  });

  it("un descuento no se come la propina", () => {
    // La propina es del mozo: un descuento del negocio no puede pagarse con
    // ella. Con total 1000, descuento 1000 y propina 500, quedan los 500.
    expect(totalesDeComanda([{ total: 1000 }], 1000, 500).total).toBe(500);
  });

  it("todo queda en enteros", () => {
    const t = totalesDeComanda([{ total: 3333 }, { total: 3333 }], 1111, 777);

    expect(Number.isInteger(t.subtotal)).toBe(true);
    expect(Number.isInteger(t.total)).toBe(true);
  });

  it("una comanda vacía da cero, no NaN", () => {
    expect(totalesDeComanda([], 0, 0)).toEqual({ subtotal: 0, total: 0 });
  });
});
