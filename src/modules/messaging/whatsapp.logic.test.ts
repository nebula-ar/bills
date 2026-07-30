import { describe, expect, it } from "vitest";

import { debtReminderMessage, normalizePhone, receiptMessage, whatsappLink } from "./whatsapp.logic";

// El formateador de es-AR separa el símbolo con espacio duro: comparamos contra
// su salida real y no contra un literal tipeado a mano.
function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

describe("normalizePhone", () => {
  it("arma el internacional a partir del número de 10 dígitos", () => {
    expect(normalizePhone("1155551234")).toBe("5491155551234");
  });

  it("ignora espacios y guiones, que es como lo escribe la gente", () => {
    expect(normalizePhone("11 5555-1234")).toBe("5491155551234");
  });

  it("saca el 0 de larga distancia", () => {
    expect(normalizePhone("011 5555-1234")).toBe("5491155551234");
  });

  it("saca el 15 de un celular de Capital", () => {
    expect(normalizePhone("011 15 5555-1234")).toBe("5491155551234");
  });

  it("saca el 15 con área de 3 dígitos", () => {
    // 0221 es de 4, 0341 también; 0223 (Mar del Plata) va con abonado de 7.
    expect(normalizePhone("0341 15 555-1234")).toBe("5493415551234");
  });

  it("respeta un número ya internacional", () => {
    expect(normalizePhone("+54 9 11 5555-1234")).toBe("5491155551234");
  });

  it("agrega el 9 al internacional que no lo trae", () => {
    expect(normalizePhone("+54 11 5555 1234")).toBe("5491155551234");
  });

  it("saca el prefijo de salida internacional", () => {
    expect(normalizePhone("005491155551234")).toBe("5491155551234");
  });

  it("descarta lo que no es un teléfono", () => {
    expect(normalizePhone("1234")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("escapa el mensaje", () => {
    const link = whatsappLink("1155551234", "Hola & chau");
    expect(link).toBe("https://wa.me/5491155551234?text=Hola%20%26%20chau");
  });

  it("sin número válido deja elegir el contacto en vez de romper", () => {
    expect(whatsappLink(null, "Hola")).toBe("https://wa.me/?text=Hola");
  });
});

describe("mensajes", () => {
  it("el comprobante lista los ítems y cierra con el total", () => {
    const message = receiptMessage({
      businessName: "Kiosco El Rulo",
      dateLabel: "20/07/2026",
      items: [{ description: "Alfajor triple", quantity: "2", total: 3_600 }],
      total: 3_600,
    });

    expect(message).toContain("*Kiosco El Rulo*");
    expect(message).toContain(`• 2 × Alfajor triple: ${money(3_600)}`);
    expect(message).toContain(`*Total: ${money(3_600)}*`);
  });

  it("el recordatorio nombra al cliente y su saldo", () => {
    const message = debtReminderMessage({
      businessName: "Kiosco El Rulo",
      customerName: "Ana",
      balance: 12_000,
    });

    expect(message).toContain("Hola Ana!");
    expect(message).toContain(money(12_000));
  });
});
