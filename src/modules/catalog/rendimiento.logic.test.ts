import { describe, expect, it } from "vitest";

import { calcularRendimiento, calcularVariacion } from "./rendimiento.logic";

const PASTELERIA = "cat-past";
const BEBIDAS = "cat-beb";

const VENTAS = [
  { productId: "alfajor", facturado: 300_000, categoryId: PASTELERIA },
  { productId: "medialuna", facturado: 500_000, categoryId: PASTELERIA },
  { productId: "cremona", facturado: 100_000, categoryId: PASTELERIA },
  { productId: "cafe", facturado: 100_000, categoryId: BEBIDAS },
];

describe("calcularRendimiento", () => {
  it("ubica el puesto dentro de SU categoría, no del catálogo entero", () => {
    const r = calcularRendimiento({
      productId: "alfajor",
      categoryId: PASTELERIA,
      ventas: VENTAS,
      facturadoPeriodoAnterior: 0,
    });

    // Medialuna (500k) va primero, alfajor (300k) segundo. El café no compite.
    expect(r.puesto).toBe(2);
    expect(r.deCuantos).toBe(3);
  });

  it("calcula la participación sobre TODO lo facturado, no sobre su categoría", () => {
    const r = calcularRendimiento({
      productId: "alfajor",
      categoryId: PASTELERIA,
      ventas: VENTAS,
      facturadoPeriodoAnterior: 0,
    });

    // 300.000 sobre 1.000.000 del negocio entero.
    expect(r.participacion).toBe(30);
  });

  it("no cuenta a los que no vendieron nada", () => {
    // Incluirlos inflaría el denominador: "#1 de 128" con 125 que ni compitieron.
    const r = calcularRendimiento({
      productId: "alfajor",
      categoryId: PASTELERIA,
      ventas: [...VENTAS, { productId: "pan", facturado: 0, categoryId: PASTELERIA }],
      facturadoPeriodoAnterior: 0,
    });

    expect(r.deCuantos).toBe(3);
  });

  it("un producto sin ventas no tiene puesto ni participación", () => {
    const r = calcularRendimiento({
      productId: "pan",
      categoryId: PASTELERIA,
      ventas: VENTAS,
      facturadoPeriodoAnterior: 0,
    });

    expect(r.puesto).toBeNull();
    expect(r.participacion).toBeNull();
  });

  it("los que no tienen categoría compiten entre ellos", () => {
    const sueltos = [
      { productId: "x", facturado: 50_000, categoryId: null },
      { productId: "y", facturado: 90_000, categoryId: null },
    ];
    const r = calcularRendimiento({
      productId: "x",
      categoryId: null,
      ventas: sueltos,
      facturadoPeriodoAnterior: 0,
    });

    expect(r.puesto).toBe(2);
    expect(r.deCuantos).toBe(2);
  });

  it("redondea la participación a un decimal", () => {
    const r = calcularRendimiento({
      productId: "cafe",
      categoryId: BEBIDAS,
      ventas: VENTAS,
      facturadoPeriodoAnterior: 0,
    });

    expect(r.participacion).toBe(10);
  });
});

describe("calcularVariacion", () => {
  it("compara contra el período anterior", () => {
    expect(calcularVariacion(118_000, 100_000)).toBe(18);
    expect(calcularVariacion(80_000, 100_000)).toBe(-20);
  });

  it("sin base anterior no hay porcentaje", () => {
    // Pasar de 0 a $500.000 no es "+100%" ni "+∞": es un producto que empezó a
    // venderse. Un porcentaje ahí inventa una base, y encima lo deja igual que
    // uno que duplicó, que es otra cosa.
    expect(calcularVariacion(500_000, 0)).toBeNull();
    expect(calcularVariacion(0, 0)).toBeNull();
  });

  it("dejar de vender es -100%, no null", () => {
    expect(calcularVariacion(0, 100_000)).toBe(-100);
  });
});
