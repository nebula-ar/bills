import { describe, expect, it } from "vitest";

import { buildOutflowTimeline, sumOutflows, type Outflow } from "./outflow.logic";

function expense(id: string, day: number, amount: number): Outflow {
  return { kind: "EXPENSE", id, amount, occurredAt: new Date(2026, 6, day) };
}

function payment(id: string, day: number, amount: number): Outflow {
  return { kind: "PAYMENT", id, amount, occurredAt: new Date(2026, 6, day) };
}

describe("buildOutflowTimeline", () => {
  it("mezcla gastos y pagos en una sola línea de tiempo, del más nuevo al más viejo", () => {
    const timeline = buildOutflowTimeline([expense("a", 3, 100), payment("b", 10, 200), expense("c", 7, 300)]);

    expect(timeline.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });

  it("con la misma fecha el orden es estable: no se barajan las filas entre renders", () => {
    const entries = [payment("p2", 5, 10), expense("e2", 5, 10), payment("p1", 5, 10), expense("e1", 5, 10)];

    expect(buildOutflowTimeline(entries).map((entry) => entry.id)).toEqual(["e1", "e2", "p1", "p2"]);
    expect(buildOutflowTimeline([...entries].reverse()).map((entry) => entry.id)).toEqual(["e1", "e2", "p1", "p2"]);
  });

  it("no toca el arreglo que recibe", () => {
    const entries = [expense("a", 3, 100), payment("b", 10, 200)];
    buildOutflowTimeline(entries);

    expect(entries.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("sin movimientos devuelve vacío", () => {
    expect(buildOutflowTimeline([])).toEqual([]);
  });
});

describe("sumOutflows", () => {
  it("suma gastos y pagos por igual: los dos son plata que salió", () => {
    expect(sumOutflows([expense("a", 3, 100), payment("b", 10, 200)])).toBe(300);
  });

  it("una factura pagada en cuotas suma lo pagado, no el total de la factura", () => {
    // Factura de $100.000 en tres pagos. Si alguna vez sumáramos el total de la
    // compra además de sus pagos, acá darían $200.000 y el dueño creería que
    // gastó el doble.
    const cuotas = [payment("p1", 2, 40_000), payment("p2", 12, 30_000), payment("p3", 22, 30_000)];

    expect(sumOutflows(cuotas)).toBe(100_000);
  });

  it("sin movimientos es cero, no NaN", () => {
    expect(sumOutflows([])).toBe(0);
  });
});
