import { describe, expect, it } from "vitest";

import { commissionFor, summarizeCommissions } from "./commissions.logic";

describe("commissionFor", () => {
  it("aplica el porcentaje sobre lo cobrado", () => {
    expect(commissionFor(100_000, 10)).toBe(10_000);
    expect(commissionFor(45_000, 15)).toBe(6750);
  });

  it("redondea a peso entero", () => {
    expect(commissionFor(1001, 33)).toBe(330);
  });

  it("sin porcentaje no hay comisión", () => {
    expect(commissionFor(100_000, 0)).toBe(0);
  });

  it("nunca paga más del 100% de lo vendido", () => {
    expect(commissionFor(10_000, 150)).toBe(10_000);
  });

  it("un total en cero no genera comisión", () => {
    expect(commissionFor(0, 20)).toBe(0);
  });
});

describe("summarizeCommissions", () => {
  const staff = [
    { id: "a", name: "Ana", commissionRate: 10 },
    { id: "b", name: "Beto", commissionRate: 15 },
    { id: "c", name: "Cami", commissionRate: 0 },
  ];

  it("agrupa las ventas por empleado y calcula su comisión", () => {
    const summary = summarizeCommissions(staff, [
      { staffId: "a", total: 10_000 },
      { staffId: "a", total: 20_000 },
      { staffId: "b", total: 40_000 },
    ]);

    const ana = summary.rows.find((row) => row.staffId === "a");
    const beto = summary.rows.find((row) => row.staffId === "b");

    expect(ana).toMatchObject({ sales: 2, sold: 30_000, commission: 3000 });
    expect(beto).toMatchObject({ sales: 1, sold: 40_000, commission: 6000 });
  });

  it("incluye a los que no vendieron: al liquidar se mira a todo el equipo", () => {
    const summary = summarizeCommissions(staff, [{ staffId: "a", total: 10_000 }]);

    expect(summary.rows).toHaveLength(3);
    expect(summary.rows.find((row) => row.staffId === "c")).toMatchObject({ sales: 0, sold: 0, commission: 0 });
  });

  it("un empleado sin porcentaje no genera comisión aunque venda", () => {
    const summary = summarizeCommissions(staff, [{ staffId: "c", total: 90_000 }]);

    expect(summary.rows.find((row) => row.staffId === "c")).toMatchObject({ sold: 90_000, commission: 0 });
    expect(summary.totalCommission).toBe(0);
  });

  it("ordena por lo vendido, de mayor a menor", () => {
    const summary = summarizeCommissions(staff, [
      { staffId: "a", total: 10_000 },
      { staffId: "b", total: 50_000 },
    ]);

    expect(summary.rows.map((row) => row.staffId)).toEqual(["b", "a", "c"]);
  });

  it("suma los totales del período", () => {
    const summary = summarizeCommissions(staff, [
      { staffId: "a", total: 10_000 },
      { staffId: "b", total: 40_000 },
    ]);

    expect(summary.totalSold).toBe(50_000);
    expect(summary.totalCommission).toBe(1000 + 6000);
  });

  it("sin ventas, todo en cero", () => {
    const summary = summarizeCommissions(staff, []);

    expect(summary.totalSold).toBe(0);
    expect(summary.totalCommission).toBe(0);
    expect(summary.rows.every((row) => row.sales === 0)).toBe(true);
  });

  it("el redondeo se aplica al total del período, no venta por venta", () => {
    // Tres ventas de 333 al 33%: 109,89 cada una. Sumar redondeos daría 330;
    // sobre el total (999) da 330 también, pero el criterio queda explícito.
    const summary = summarizeCommissions([{ id: "x", name: "X", commissionRate: 33 }], [
      { staffId: "x", total: 333 },
      { staffId: "x", total: 333 },
      { staffId: "x", total: 333 },
    ]);

    expect(summary.rows[0].sold).toBe(999);
    expect(summary.rows[0].commission).toBe(330);
  });
});
