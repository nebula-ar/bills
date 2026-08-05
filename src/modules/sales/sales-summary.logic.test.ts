import { describe, expect, it } from "vitest";

import { SaleStatus } from "@/generated/prisma/enums";

import { resumenDelPeriodo, totalizar } from "./sales-summary.logic";

const venta = (total: number, pagos: [string, number][], status: SaleStatus = SaleStatus.COMPLETED) => ({
  total,
  status,
  payments: pagos.map(([method, amount]) => ({ method, amount })),
});

describe("los totales del período", () => {
  it("sin ventas no inventa números", () => {
    // Un promedio sobre cero ventas es una división por cero: tiene que dar 0,
    // no NaN ni Infinity, que es lo que después se imprime en pantalla.
    expect(totalizar([])).toEqual({
      cantidad: 0,
      facturado: 0,
      ticketPromedio: 0,
      porMedio: [],
      canceladas: 0,
    });
  });

  it("suma lo facturado y saca el ticket promedio", () => {
    const t = totalizar([venta(1000, [["CASH", 1000]]), venta(3000, [["CASH", 3000]])]);
    expect(t.cantidad).toBe(2);
    expect(t.facturado).toBe(4000);
    expect(t.ticketPromedio).toBe(2000);
  });

  it("las canceladas NO suman y se cuentan aparte", () => {
    // Si sumaran, la caja del día cerraría con plata que nadie tiene.
    const t = totalizar([
      venta(1000, [["CASH", 1000]]),
      venta(9999, [["CASH", 9999]], SaleStatus.CANCELLED),
    ]);
    expect(t.facturado).toBe(1000);
    expect(t.cantidad).toBe(1);
    expect(t.canceladas).toBe(1);
    expect(t.porMedio).toEqual([{ metodo: "CASH", monto: 1000 }]);
  });

  it("el promedio queda entero: son pesos sin centavos", () => {
    // 1000 / 3 = 333,33. Mostrar decimales acá es precisión inventada.
    const t = totalizar([venta(400, [["CASH", 400]]), venta(300, [["CASH", 300]]), venta(300, [["CASH", 300]])]);
    expect(t.ticketPromedio).toBe(333);
    expect(Number.isInteger(t.ticketPromedio)).toBe(true);
  });

  it("agrupa por medio de pago y ordena por lo que más entró", () => {
    // Lo que se quiere saber es por dónde entra la plata.
    const t = totalizar([
      venta(1000, [["CASH", 1000]]),
      venta(5000, [["DEBIT_CARD", 5000]]),
      venta(2000, [["CASH", 2000]]),
    ]);
    expect(t.porMedio).toEqual([
      { metodo: "DEBIT_CARD", monto: 5000 },
      { metodo: "CASH", monto: 3000 },
    ]);
  });

  it("una venta con pago dividido reparte entre los dos medios", () => {
    // El total de la venta es uno, pero la plata entró por dos lados: mezclarlo
    // haría que el arqueo de caja no cierre.
    const t = totalizar([venta(1000, [["CASH", 600], ["QR", 400]])]);
    expect(t.facturado).toBe(1000);
    expect(t.cantidad).toBe(1);
    expect(t.porMedio).toEqual([
      { metodo: "CASH", monto: 600 },
      { metodo: "QR", monto: 400 },
    ]);
  });

  it("con montos empatados el orden no baila entre renders", () => {
    const t = totalizar([venta(1000, [["QR", 500], ["CASH", 500]])]);
    expect(t.porMedio.map((p) => p.metodo)).toEqual(["CASH", "QR"]);
  });

  it("una venta sin pagos cuenta igual en el total facturado", () => {
    // Existen: una venta fiada vieja o una migrada sin renglones de pago. No
    // aparece en ningún medio, pero facturarse se facturó.
    const t = totalizar([venta(800, [])]);
    expect(t.facturado).toBe(800);
    expect(t.cantidad).toBe(1);
    expect(t.porMedio).toEqual([]);
  });
});

describe("filtrar por medio de pago", () => {
  const delPeriodo = [
    venta(1000, [["CASH", 1000]]),
    venta(5000, [["DEBIT_CARD", 5000]]),
    venta(2000, [["CASH", 1200], ["QR", 800]]),
  ];

  it("sin filtro devuelve todo", () => {
    expect(resumenDelPeriodo(delPeriodo).totales.facturado).toBe(8000);
  });

  it("filtra las ventas que se pagaron con ese medio", () => {
    const { totales } = resumenDelPeriodo(delPeriodo, "DEBIT_CARD");
    expect(totales.cantidad).toBe(1);
    expect(totales.facturado).toBe(5000);
  });

  it("una venta dividida aparece en los dos medios", () => {
    // Se pagó con los dos: esconderla de uno haría que el filtro mienta.
    expect(resumenDelPeriodo(delPeriodo, "CASH").totales.cantidad).toBe(2);
    expect(resumenDelPeriodo(delPeriodo, "QR").totales.cantidad).toBe(1);
  });

  it("los medios ofrecidos NO se achican al filtrar", () => {
    // Si salieran de lo filtrado, al elegir "Efectivo" desaparecerían los demás
    // chips y no habría forma de cambiar de filtro sin volver atrás.
    const sinFiltro = resumenDelPeriodo(delPeriodo).metodosDisponibles;
    const filtrado = resumenDelPeriodo(delPeriodo, "CASH").metodosDisponibles;
    expect(sinFiltro).toEqual(["CASH", "DEBIT_CARD", "QR"]);
    expect(filtrado).toEqual(sinFiltro);
  });

  it("los medios de una venta cancelada no se ofrecen como filtro", () => {
    // Ofrecer un filtro que devuelve una lista vacía es prometer algo que no
    // está.
    const { metodosDisponibles } = resumenDelPeriodo([
      venta(1000, [["CASH", 1000]]),
      venta(9999, [["TRANSFER", 9999]], SaleStatus.CANCELLED),
    ]);
    expect(metodosDisponibles).toEqual(["CASH"]);
  });

  it("un medio que nadie usó no devuelve nada, sin romperse", () => {
    const { totales } = resumenDelPeriodo(delPeriodo, "ACCOUNT");
    expect(totales.cantidad).toBe(0);
    expect(totales.facturado).toBe(0);
    expect(totales.ticketPromedio).toBe(0);
  });
});
