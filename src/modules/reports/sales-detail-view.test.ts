import { describe, expect, it } from "vitest";

import type { SalesDetailSale } from "./sales-detail-view";
import { summarizePayments, toSalesDetailRows } from "./sales-detail-view";

function makeSale(overrides: Partial<SalesDetailSale> = {}): SalesDetailSale {
  return {
    id: "clx1234567890abcdef",
    soldAt: new Date(2026, 11, 12, 9, 7), // 12/12/2026 09:07
    total: 15000,
    branchName: "Local 1",
    staffName: "María",
    customerLabel: "Consumidor final",
    items: [{ description: "Café", quantity: 2000 }],
    payments: [{ method: "CASH" as SalesDetailSale["payments"][number]["method"], amount: 15000 }],
    ...overrides,
  };
}

describe("summarizePayments", () => {
  it("dice el método único", () => {
    expect(summarizePayments([{ method: "QR", amount: 5000 }])).toBe("QR");
  });

  it("dice Mixto cuando hay más de un método", () => {
    expect(
      summarizePayments([
        { method: "CASH", amount: 1000 },
        { method: "QR", amount: 2000 },
      ]),
    ).toBe("Mixto");
  });

  it("dice Sin pago cuando no hay pagos", () => {
    expect(summarizePayments([])).toBe("Sin pago");
  });
});

describe("toSalesDetailRows", () => {
  it("arma una fila por venta con etiquetas listas para mostrar", () => {
    const rows = toSalesDetailRows([makeSale()]);

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      id: "clx1234567890abcdef",
      dateLabel: "12/12 09:07",
      soldAtLabel: "2026-12-12 09:07",
      shortId: "ABCDEF",
      staffName: "María",
      branchName: "Local 1",
      customerLabel: "Consumidor final",
      paymentLabel: "Efectivo",
      total: 15000,
    });
    expect(row.itemSummary).toBe("Café x2");
  });

  it("formatea cantidades fraccionarias (milésimas) y corta el detalle con comas", () => {
    const sale = makeSale({
      items: [
        { description: "Tomate", quantity: 1250 },
        { description: "Pan", quantity: 1000 },
      ],
    });

    expect(toSalesDetailRows([sale])[0].itemSummary).toBe("Tomate x1,25, Pan x1");
  });

  it("puede mezclar métodos de pago en una venta", () => {
    const sale = makeSale({
      payments: [
        { method: "CASH" as const, amount: 10000 },
        { method: "MERCADO_PAGO" as const, amount: 5000 },
      ],
    });

    expect(toSalesDetailRows([sale])[0].paymentLabel).toBe("Mixto");
  });

  it("no asume que la lista viene ordenada: respeta el orden de entrada", () => {
    const rows = toSalesDetailRows([
      makeSale({ id: "clx1111", soldAt: new Date(2026, 11, 11, 8, 0) }),
      makeSale({ id: "clx2222", soldAt: new Date(2026, 11, 12, 8, 0) }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(["clx1111", "clx2222"]);
  });
});
