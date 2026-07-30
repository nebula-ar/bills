import { describe, expect, it } from "vitest";

import {
  birthdayMessage,
  birthdaysInMonth,
  daysSince,
  firstName,
  lapsedCustomers,
  reviewMessage,
  topCustomers,
  winBackMessage,
  type CustomerActivity,
} from "./marketing.logic";

const NOW = new Date(2026, 6, 20, 15, 0); // 20 de julio de 2026

function customer(over: Partial<CustomerActivity> = {}): CustomerActivity {
  return {
    id: "c1",
    name: "Rodrigo Pérez",
    phone: "1155551234",
    lastPurchaseAt: new Date(2026, 6, 19),
    purchaseCount: 3,
    totalSpent: 30_000,
    birthday: null,
    ...over,
  };
}

describe("daysSince", () => {
  it("cuenta por día, no por horas", () => {
    // Compró ayer a las 23:00; hoy son las 15:00. Es 1 día, no 0.
    expect(daysSince(new Date(2026, 6, 19, 23, 0), NOW)).toBe(1);
  });

  it("hoy es cero", () => {
    expect(daysSince(new Date(2026, 6, 20, 9, 0), NOW)).toBe(0);
  });
});

describe("lapsedCustomers", () => {
  it("lista a los que hace rato no vienen, del más perdido al menos", () => {
    const result = lapsedCustomers(
      [
        customer({ id: "reciente", lastPurchaseAt: new Date(2026, 6, 15) }),
        customer({ id: "hace-2-meses", lastPurchaseAt: new Date(2026, 4, 20) }),
        customer({ id: "hace-50-dias", lastPurchaseAt: new Date(2026, 4, 31) }),
      ],
      NOW,
    );

    expect(result.map((item) => item.id)).toEqual(["hace-2-meses", "hace-50-dias"]);
    expect(result[0].daysAway).toBe(61);
  });

  it("el que nunca compró no es un cliente perdido", () => {
    expect(lapsedCustomers([customer({ lastPurchaseAt: null })], NOW)).toEqual([]);
  });

  it("el umbral se puede mover: no es lo mismo un kiosco que una barbería", () => {
    const clientes = [customer({ id: "hace-10-dias", lastPurchaseAt: new Date(2026, 6, 10) })];

    expect(lapsedCustomers(clientes, NOW)).toEqual([]);
    expect(lapsedCustomers(clientes, NOW, 7)).toHaveLength(1);
  });

  it("justo en el umbral ya cuenta", () => {
    expect(lapsedCustomers([customer({ lastPurchaseAt: new Date(2026, 6, 13) })], NOW, 7)).toHaveLength(1);
  });
});

describe("topCustomers", () => {
  it("ordena por lo que gastaron", () => {
    const result = topCustomers([
      customer({ id: "a", totalSpent: 10_000 }),
      customer({ id: "b", totalSpent: 90_000 }),
      customer({ id: "c", totalSpent: 50_000 }),
    ]);

    expect(result.map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("deja afuera al que nunca gastó", () => {
    expect(topCustomers([customer({ totalSpent: 0 })])).toEqual([]);
  });

  it("respeta el límite", () => {
    const muchos = Array.from({ length: 20 }, (_, i) => customer({ id: `c${i}`, totalSpent: i * 1000 + 1000 }));
    expect(topCustomers(muchos, 3)).toHaveLength(3);
  });
});

describe("birthdaysInMonth", () => {
  it("trae los del mes ordenados por día, sin importar el año", () => {
    const result = birthdaysInMonth(
      [
        customer({ id: "julio-25", birthday: new Date(1990, 6, 25) }),
        customer({ id: "agosto", birthday: new Date(1990, 7, 3) }),
        customer({ id: "julio-2", birthday: new Date(1985, 6, 2) }),
      ],
      NOW,
    );

    expect(result.map((item) => item.id)).toEqual(["julio-2", "julio-25"]);
  });

  it("marca al que cumple hoy", () => {
    const result = birthdaysInMonth([customer({ birthday: new Date(1990, 6, 20) })], NOW);

    expect(result[0].turnsToday).toBe(true);
  });

  it("sin cumpleaños cargado no aparece", () => {
    expect(birthdaysInMonth([customer({ birthday: null })], NOW)).toEqual([]);
  });
});

describe("mensajes", () => {
  it("saluda por el primer nombre, no por el nombre completo", () => {
    expect(firstName("Rodrigo Pérez")).toBe("Rodrigo");
    expect(firstName("  Ana  ")).toBe("Ana");
  });

  it("el de recuperación no reclama nada", () => {
    const message = winBackMessage({ businessName: "Kiosco El Rulo", customerName: "Rodrigo Pérez", daysAway: 60 });

    expect(message).toContain("Hola Rodrigo!");
    expect(message).toContain("Kiosco El Rulo");
    // Nada de "hace 60 días que no venís": suena a reproche.
    expect(message).not.toContain("60");
  });

  it("suma la promo cuando hay una para ofrecer", () => {
    const message = winBackMessage({
      businessName: "Kiosco El Rulo",
      customerName: "Ana",
      daysAway: 60,
      offer: "Tenés 20% off esta semana.",
    });

    expect(message).toContain("20% off");
  });

  it("el de cumpleaños saluda antes que vender", () => {
    const message = birthdayMessage({ businessName: "Barbería Don Julio", customerName: "Juan Pérez" });

    expect(message.startsWith("¡Feliz cumple, Juan!")).toBe(true);
  });

  it("el de reseña lleva el link", () => {
    const message = reviewMessage({
      businessName: "Kiosco El Rulo",
      customerName: "Ana",
      url: "https://g.page/r/abc",
    });

    expect(message).toContain("https://g.page/r/abc");
  });
});
