import { describe, expect, it } from "vitest";

import { estadoDeVencimiento, ordenarPorUrgencia } from "./vencimientos";

/**
 * Avisos de vencimiento.
 *
 * La propuesta promete "mínimos, vencimientos y avisos", y el aviso es la parte
 * que sirve: una fecha guardada que nadie mira no evitó nunca que se tire nada.
 *
 * El día de referencia se inyecta para que los tests no dependan del reloj ni
 * se rompan mañana.
 */

const HOY = new Date("2026-08-05T10:00:00Z");
const enDias = (d: number) => new Date(HOY.getTime() + d * 86_400_000);

describe("cuándo hay que preocuparse", () => {
  it("sin fecha cargada no hay nada que avisar", () => {
    // La mayoría de los productos no vence: una bolsa de harina sí, un corte
    // de pelo no. Sin fecha, silencio.
    expect(estadoDeVencimiento(null, HOY)).toBe("sin-fecha");
  });

  it("con margen de sobra está tranquilo", () => {
    expect(estadoDeVencimiento(enDias(30), HOY)).toBe("ok");
    expect(estadoDeVencimiento(enDias(8), HOY)).toBe("ok");
  });

  it("dentro de la semana avisa", () => {
    // Una semana es lo que le da tiempo al negocio a hacer algo: bajarlo de
    // precio, usarlo en producción, moverlo a la otra sucursal.
    expect(estadoDeVencimiento(enDias(7), HOY)).toBe("pronto");
    expect(estadoDeVencimiento(enDias(1), HOY)).toBe("pronto");
  });

  it("hoy vence: es urgente, no 'pronto'", () => {
    expect(estadoDeVencimiento(HOY, HOY)).toBe("hoy");
  });

  it("ya vencido no se confunde con por vencer", () => {
    // Son dos acciones distintas: lo que vence hoy se remata, lo vencido se
    // tira. Mezclarlos hace que se venda mercadería vencida.
    expect(estadoDeVencimiento(enDias(-1), HOY)).toBe("vencido");
    expect(estadoDeVencimiento(enDias(-40), HOY)).toBe("vencido");
  });

  it("la hora del día no cambia el veredicto", () => {
    // Una fecha de vencimiento es un DÍA. Si comparáramos con la hora exacta,
    // algo que vence hoy a la mañana aparecería como vencido a la tarde.
    const hoyTarde = new Date("2026-08-05T23:00:00Z");
    expect(estadoDeVencimiento(new Date("2026-08-05T01:00:00Z"), hoyTarde)).toBe("hoy");
  });
});

describe("el orden en que se muestran", () => {
  it("lo más urgente primero, y lo que no vence al final", () => {
    // El que abre la pantalla quiere ver primero lo que tiene que resolver hoy.
    const filas = [
      { id: "sin-fecha", expiresAt: null },
      { id: "en-un-mes", expiresAt: enDias(30) },
      { id: "vencido", expiresAt: enDias(-3) },
      { id: "en-dos-dias", expiresAt: enDias(2) },
    ];

    expect(ordenarPorUrgencia(filas).map((f) => f.id)).toEqual([
      "vencido",
      "en-dos-dias",
      "en-un-mes",
      "sin-fecha",
    ]);
  });

  it("no rompe con una lista vacía", () => {
    expect(ordenarPorUrgencia([])).toEqual([]);
  });
});
