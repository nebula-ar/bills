import { describe, expect, it } from "vitest";

import { StockMovementType } from "@/generated/prisma/enums";

import { autorDe, leerMovimiento, signoDe } from "./movimiento-label.logic";

describe("leerMovimiento", () => {
  it("traduce todos los tipos, sin dejar ninguno sin texto", () => {
    // Si mañana se agrega un tipo al enum, este test lo caza: sin él, la ficha
    // mostraría "undefined" en un renglón del historial.
    for (const tipo of Object.values(StockMovementType)) {
      const lectura = leerMovimiento(tipo);
      expect(lectura.titulo.length).toBeGreaterThan(0);
      expect(["entra", "sale"]).toContain(lectura.sentido);
    }
  });

  it("una venta saca y una venta anulada devuelve", () => {
    expect(leerMovimiento(StockMovementType.SALE).sentido).toBe("sale");
    expect(leerMovimiento(StockMovementType.SALE_CANCELLED).sentido).toBe("entra");
  });

  it("habla en criollo, no en jerga del enum", () => {
    expect(leerMovimiento(StockMovementType.LOSS).titulo).toBe("Merma");
    expect(leerMovimiento(StockMovementType.TRANSFER_OUT).titulo).toBe("Salida por transferencia");
  });
});

describe("signoDe", () => {
  it("sale del número, no del tipo", () => {
    // Un ajuste puede sumar o restar: deducir el signo del tipo mostraría "+"
    // en un ajuste que descontó.
    expect(signoDe(10_000)).toBe("+");
    expect(signoDe(-2_000)).toBe("−");
  });

  it("en cero no inventa signo", () => {
    expect(signoDe(0)).toBe("");
  });
});

describe("autorDe", () => {
  it("antepone 'por' al nombre", () => {
    expect(autorDe("Juan Pérez")).toBe("por Juan Pérez");
  });

  it("sin autor no inventa uno", () => {
    // Los movimientos que genera el sistema al vender no siempre traen usuario.
    // "por Sistema" haría creer que existe alguien con ese nombre.
    expect(autorDe(null)).toBeNull();
    expect(autorDe(undefined)).toBeNull();
    expect(autorDe("   ")).toBeNull();
  });
});
