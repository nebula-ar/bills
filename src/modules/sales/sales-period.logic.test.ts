import { describe, expect, it } from "vitest";

import { parsePeriodo, rangoDelPeriodo } from "./sales-period.logic";

/**
 * Miércoles 5 de agosto de 2026, 15:30. Hora local a propósito: el corte del
 * día es el del negocio, no UTC.
 */
const HOY = new Date(2026, 7, 5, 15, 30, 0);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("qué abarca cada período", () => {
  it("hoy va de las 00:00 de hoy a las 00:00 de mañana", () => {
    const { desde, hasta } = rangoDelPeriodo("hoy", HOY);
    expect(iso(desde)).toBe("2026-08-05 00:00");
    expect(iso(hasta)).toBe("2026-08-06 00:00");
  });

  it("ayer no incluye nada de hoy", () => {
    // Si el tope fuera inclusivo, la primera venta de hoy aparecería en ayer y
    // los dos períodos sumarían de más.
    const { desde, hasta } = rangoDelPeriodo("ayer", HOY);
    expect(iso(desde)).toBe("2026-08-04 00:00");
    expect(iso(hasta)).toBe("2026-08-05 00:00");
  });

  it("7 días cuenta hoy adentro, no siete días ANTES de hoy", () => {
    // Para el que atiende, "7 días" incluye el día que está viviendo.
    const { desde, hasta } = rangoDelPeriodo("semana", HOY);
    expect(iso(desde)).toBe("2026-07-30 00:00");
    expect(iso(hasta)).toBe("2026-08-06 00:00");
    expect(Math.round((hasta.getTime() - desde.getTime()) / 86_400_000)).toBe(7);
  });

  it("el mes arranca el día 1 y llega hasta hoy", () => {
    const { desde, hasta } = rangoDelPeriodo("mes", HOY);
    expect(iso(desde)).toBe("2026-08-01 00:00");
    expect(iso(hasta)).toBe("2026-08-06 00:00");
  });

  it("el mes no se va al mes anterior estando el día 1", () => {
    // `setDate(1)` sobre un día 1 no tiene que mover nada.
    const primero = new Date(2026, 7, 1, 9, 0, 0);
    const { desde, hasta } = rangoDelPeriodo("mes", primero);
    expect(iso(desde)).toBe("2026-08-01 00:00");
    expect(iso(hasta)).toBe("2026-08-02 00:00");
  });

  it("los 7 días cruzan el cambio de mes sin romperse", () => {
    const dosDeAgosto = new Date(2026, 7, 2, 10, 0, 0);
    expect(iso(rangoDelPeriodo("semana", dosDeAgosto).desde)).toBe("2026-07-27 00:00");
  });

  it("ayer cruza el cambio de año", () => {
    const primeroDeEnero = new Date(2027, 0, 1, 8, 0, 0);
    expect(iso(rangoDelPeriodo("ayer", primeroDeEnero).desde)).toBe("2026-12-31 00:00");
  });

  it("los rangos de hoy y ayer se tocan sin pisarse ni dejar hueco", () => {
    // Cada venta cae en exactamente un período: ni contada dos veces, ni
    // perdida en el medio.
    expect(rangoDelPeriodo("ayer", HOY).hasta.getTime()).toBe(rangoDelPeriodo("hoy", HOY).desde.getTime());
  });
});

describe("el período que llega por la URL", () => {
  it("acepta los conocidos", () => {
    expect(parsePeriodo("mes")).toBe("mes");
    expect(parsePeriodo("semana")).toBe("semana");
  });

  it("cualquier otra cosa cae en hoy", () => {
    // La URL la escribe cualquiera. Sin esto, un `?periodo=<script>` decidiría
    // qué se consulta.
    expect(parsePeriodo(undefined)).toBe("hoy");
    expect(parsePeriodo("")).toBe("hoy");
    expect(parsePeriodo("año")).toBe("hoy");
    expect(parsePeriodo("__proto__")).toBe("hoy");
  });
});
