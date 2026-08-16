import { describe, expect, it } from "vitest";

import { claveDelDia, serieDiaria, topeDeLaSerie } from "./serie-diaria.logic";

// Un miércoles, para que la serie cruce el fin de semana.
const HASTA = new Date(2026, 7, 15, 18, 0);

describe("serieDiaria", () => {
  it("devuelve exactamente los días pedidos, terminando en `hasta`", () => {
    const serie = serieDiaria({ ventas: [], hasta: HASTA, dias: 7 });

    expect(serie).toHaveLength(7);
    expect(serie[6].dia).toBe("2026-08-15");
    expect(serie[0].dia).toBe("2026-08-09");
  });

  it("incluye los días SIN ventas, en cero", () => {
    // Sin esto, tres ventas salteadas en dos semanas se dibujarían como tres
    // días seguidos de actividad.
    const serie = serieDiaria({
      ventas: [{ at: new Date(2026, 7, 15, 10), facturado: 5_000 }],
      hasta: HASTA,
      dias: 7,
    });

    expect(serie.filter((d) => d.facturado === 0)).toHaveLength(6);
    expect(serie[6].facturado).toBe(5_000);
  });

  it("suma varias ventas del mismo día", () => {
    const serie = serieDiaria({
      ventas: [
        { at: new Date(2026, 7, 14, 9), facturado: 1_000 },
        { at: new Date(2026, 7, 14, 20), facturado: 2_500 },
      ],
      hasta: HASTA,
      dias: 7,
    });

    expect(serie.find((d) => d.dia === "2026-08-14")?.facturado).toBe(3_500);
  });

  it("deja afuera lo que cae fuera de la ventana", () => {
    const serie = serieDiaria({
      ventas: [{ at: new Date(2026, 7, 1, 10), facturado: 9_999 }],
      hasta: HASTA,
      dias: 7,
    });

    expect(serie.every((d) => d.facturado === 0)).toBe(true);
  });

  it("etiqueta con día de semana y número", () => {
    const serie = serieDiaria({ ventas: [], hasta: HASTA, dias: 2 });

    expect(serie[1].etiqueta).toBe("Sáb 15");
  });
});

describe("claveDelDia", () => {
  it("usa la hora local y no UTC", () => {
    // Una venta de las 22 h argentinas es del 15, no del 16: con toISOString
    // (UTC-3 → +3 h) se correría de columna en el gráfico.
    expect(claveDelDia(new Date(2026, 7, 15, 22, 30))).toBe("2026-08-15");
  });

  it("rellena mes y día a dos dígitos", () => {
    expect(claveDelDia(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("topeDeLaSerie", () => {
  it("es el día más alto", () => {
    const serie = serieDiaria({
      ventas: [
        { at: new Date(2026, 7, 13), facturado: 3_000 },
        { at: new Date(2026, 7, 14), facturado: 8_000 },
      ],
      hasta: HASTA,
      dias: 7,
    });

    expect(topeDeLaSerie(serie)).toBe(8_000);
  });

  it("sin ventas no hay escala", () => {
    // Dibujar contra un máximo de cero sería dividir por cero, y además no hay
    // nada que comparar.
    expect(topeDeLaSerie(serieDiaria({ ventas: [], hasta: HASTA, dias: 7 }))).toBeNull();
  });
});
