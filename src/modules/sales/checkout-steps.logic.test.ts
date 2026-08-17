import { describe, expect, it } from "vitest";

import { SaleChannel } from "@/generated/prisma/enums";

import { pasosDelCobro, puedeAvanzar } from "./checkout-steps.logic";

const claves = (input: { usaSalon: boolean; canal: SaleChannel; pagaEnEfectivo?: boolean; destinoYaElegido?: boolean }) =>
  pasosDelCobro({ pagaEnEfectivo: false, ...input }).map((paso) => paso.key);

describe("qué pasos tiene el cobro", () => {
  it("sin salón son dos: cómo paga y confirmar", () => {
    // Una barbería no elige mesa ni canal. Meterle esos pasos sería cobrarle
    // dos toques por venta a cambio de nada.
    expect(claves({ usaSalon: false, canal: SaleChannel.COUNTER })).toEqual(["pago", "confirmar"]);
  });

  it("sin salón, ni siquiera si el canal quedó en mesa", () => {
    // El canal es estado del cliente y puede quedar viejo. Que un negocio sin
    // salón termine mostrando "¿Qué mesa?" con cero mesas cargadas es peor que
    // ignorarlo.
    expect(claves({ usaSalon: false, canal: SaleChannel.TABLE })).toEqual(["pago", "confirmar"]);
  });

  it("con salón aparece el paso de dónde salió la venta", () => {
    expect(claves({ usaSalon: true, canal: SaleChannel.COUNTER })).toEqual([
      "donde",
      "pago",
      "confirmar",
    ]);
  });

  it("para llevar tampoco pregunta la mesa", () => {
    expect(claves({ usaSalon: true, canal: SaleChannel.TAKEAWAY })).toEqual([
      "donde",
      "pago",
      "confirmar",
    ]);
  });

  it("recién al elegir mesa se agrega el paso de la mesa", () => {
    expect(claves({ usaSalon: true, canal: SaleChannel.TABLE })).toEqual([
      "donde",
      "mesa",
      "pago",
      "confirmar",
    ]);
  });

  it("pagando en efectivo aparece el paso del vuelto, después de elegir el medio", () => {
    // Después y no antes: recién al saber que es efectivo tiene sentido
    // preguntar con cuánto paga.
    expect(claves({ usaSalon: false, canal: SaleChannel.COUNTER, pagaEnEfectivo: true })).toEqual([
      "pago",
      "efectivo",
      "confirmar",
    ]);
  });

  it("con tarjeta no hay paso de vuelto", () => {
    // Con débito se cobra justo: preguntar con cuánto paga sería un toque de
    // más en la mitad de las ventas.
    expect(claves({ usaSalon: false, canal: SaleChannel.COUNTER, pagaEnEfectivo: false })).toEqual([
      "pago",
      "confirmar",
    ]);
  });

  it("el vuelto se suma a los pasos del salón sin desordenarlos", () => {
    expect(claves({ usaSalon: true, canal: SaleChannel.TABLE, pagaEnEfectivo: true })).toEqual([
      "donde",
      "mesa",
      "pago",
      "efectivo",
      "confirmar",
    ]);
  });

  it("confirmar es siempre el último", () => {
    // La barra de progreso y el botón "Confirmar venta" se apoyan en esto.
    for (const usaSalon of [true, false]) {
      for (const pagaEnEfectivo of [true, false]) {
        for (const canal of [SaleChannel.COUNTER, SaleChannel.TAKEAWAY, SaleChannel.TABLE]) {
          const pasos = pasosDelCobro({ usaSalon, canal, pagaEnEfectivo });
          expect(pasos[pasos.length - 1].key).toBe("confirmar");
        }
      }
    }
  });

  it("cobrando una comanda con mesa fija no se pregunta dónde ni qué mesa", () => {
    // La mesa ya está dicha por la comanda; volver a preguntarla es reescribir
    // un dato que ya se sabe.
    expect(claves({ usaSalon: true, canal: SaleChannel.TABLE, destinoYaElegido: true })).toEqual(["pago", "confirmar"]);
  });

  it("el vuelto va siempre justo antes de confirmar", () => {
    // Es lo último que se toca antes de cerrar: el número se lee con los
    // billetes en la mano.
    for (const usaSalon of [true, false]) {
      for (const canal of [SaleChannel.COUNTER, SaleChannel.TABLE]) {
        const claves = pasosDelCobro({ usaSalon, canal, pagaEnEfectivo: true }).map((p) => p.key);
        expect(claves[claves.length - 2]).toBe("efectivo");
      }
    }
  });
});

describe("cuándo se puede avanzar", () => {
  it("en la mesa, no se sigue sin elegir una", () => {
    // Decir "mesa" y no decir cuál deja un ticket que dice mesa sin mesa.
    expect(puedeAvanzar({ paso: "mesa", tieneMesa: false, pagoValido: true })).toBe(false);
    expect(puedeAvanzar({ paso: "mesa", tieneMesa: true, pagoValido: true })).toBe(true);
  });

  it("en el pago, no se sigue con un pago que no cierra", () => {
    // Frenar acá y no al confirmar: enterarse del pago dividido incompleto
    // recién al final obliga a volver con el cliente esperando.
    expect(puedeAvanzar({ paso: "pago", tieneMesa: true, pagoValido: false })).toBe(false);
    expect(puedeAvanzar({ paso: "pago", tieneMesa: true, pagoValido: true })).toBe(true);
  });

  it("los pasos sin condición dejan pasar", () => {
    expect(puedeAvanzar({ paso: "donde", tieneMesa: false, pagoValido: false })).toBe(true);
    expect(puedeAvanzar({ paso: "confirmar", tieneMesa: false, pagoValido: false })).toBe(true);
  });
});
