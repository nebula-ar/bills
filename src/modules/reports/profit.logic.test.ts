import { describe, expect, it } from "vitest";

import { computeProfit, operatingExpensesOf } from "./profit.logic";

const base = {
  revenue: 0,
  returnedRevenue: 0,
  soldCost: 0,
  returnedCost: 0,
  operatingExpenses: 0,
  inventoryLosses: 0,
};

describe("computeProfit", () => {
  it("descuenta el costo de lo vendido y los gastos operativos", () => {
    const result = computeProfit({ ...base, revenue: 800_000, soldCost: 320_000, operatingExpenses: 150_000 });

    expect(result.profit).toBe(330_000);
    expect(result.costOfGoodsSold).toBe(320_000);
    expect(result.marginPct).toBe(41);
  });

  it("reponer mercadería no baja la ganancia: la baja venderla", () => {
    // El mes de la compra: entró stock por $500.000 y se vendió poco. Ese medio
    // millón NO aparece acá — está en la góndola, es patrimonio.
    const mesDeCompra = computeProfit({ ...base, revenue: 200_000, soldCost: 80_000, operatingExpenses: 150_000 });
    expect(mesDeCompra.profit).toBe(-30_000);

    // El mes que se vende esa mercadería, el costo aparece con la venta.
    const mesDeVenta = computeProfit({ ...base, revenue: 900_000, soldCost: 420_000, operatingExpenses: 150_000 });
    expect(mesDeVenta.profit).toBe(330_000);
  });

  it("una devolución saca la venta y devuelve el costo al stock", () => {
    // Se vendió por $10.000 algo que costó $6.000 y el cliente lo devolvió: la
    // mercadería volvió a la góndola, así que la ganancia queda en cero, no en
    // −$10.000 ni en +$4.000.
    const result = computeProfit({
      ...base,
      revenue: 10_000,
      returnedRevenue: 10_000,
      soldCost: 6_000,
      returnedCost: 6_000,
    });

    expect(result.netRevenue).toBe(0);
    expect(result.costOfGoodsSold).toBe(0);
    expect(result.profit).toBe(0);
  });

  it("sin costos cargados la ganancia da igual a la venta: infla, y por eso hay que avisar", () => {
    const result = computeProfit({ ...base, revenue: 500_000, soldCost: 0, operatingExpenses: 100_000 });

    expect(result.profit).toBe(400_000);
  });

  it("puede dar negativa", () => {
    const result = computeProfit({ ...base, revenue: 100_000, soldCost: 70_000, operatingExpenses: 90_000 });

    expect(result.profit).toBe(-60_000);
    expect(result.marginPct).toBe(-60);
  });

  it("la merma es pérdida del período: se compró y no se va a vender nunca", () => {
    const result = computeProfit({
      ...base,
      revenue: 800_000,
      soldCost: 320_000,
      operatingExpenses: 150_000,
      inventoryLosses: 45_000,
    });

    // Sin contarla darían $330.000 y los tres cajones de tomate que se tiraron
    // no aparecerían en ningún lado.
    expect(result.profit).toBe(285_000);
  });

  it("sin ventas el margen es null, no 0%", () => {
    expect(computeProfit({ ...base, operatingExpenses: 50_000 }).marginPct).toBeNull();
    expect(computeProfit(base).marginPct).toBeNull();
  });
});

describe("operatingExpensesOf", () => {
  it("deja afuera la mercadería", () => {
    const byCategory = [
      { category: "RENT", total: 180_000 },
      { category: "MERCHANDISE", total: 500_000 },
      { category: "SALARIES", total: 90_000 },
    ];

    expect(operatingExpensesOf(byCategory, "MERCHANDISE")).toBe(270_000);
  });

  it("sin gastos es cero", () => {
    expect(operatingExpensesOf([], "MERCHANDISE")).toBe(0);
  });
});
