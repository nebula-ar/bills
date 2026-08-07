import { describe, expect, it } from "vitest";

import { SaleChannel } from "@/generated/prisma/enums";

import { datosDeMesa } from "./sale-channel.logic";

/**
 * Mesa y mozo en el ticket.
 *
 * Lo que se prueba acá no es el formato: es que un dato de salón no se cuele en
 * una venta de mostrador, porque eso ensucia el ticket y el corte por canal.
 */

describe("qué se guarda de mesa y mozo", () => {
  it("una venta en mesa guarda los dos nombres", () => {
    expect(
      datosDeMesa({ channel: SaleChannel.TABLE, tableName: "Mesa 4", waiterName: "Nico" }),
    ).toEqual({ tableName: "Mesa 4", waiterName: "Nico" });
  });

  it("mostrador y para llevar no guardan mesa aunque se la manden", () => {
    // El cliente del POS puede mandar cualquier cosa: si el mozo elige "Mesa 4"
    // y después cambia a "Para llevar", el dato viejo sigue en el estado. La
    // regla vive acá y no en la pantalla, que es donde se olvida.
    for (const canal of [SaleChannel.COUNTER, SaleChannel.TAKEAWAY]) {
      expect(datosDeMesa({ channel: canal, tableName: "Mesa 4", waiterName: "Nico" })).toEqual({
        tableName: null,
        waiterName: null,
      });
    }
  });

  it("sin canal tampoco guarda nada", () => {
    // Los rubros que no usan salón no mandan canal: una barbería no tiene mesas.
    expect(datosDeMesa({ tableName: "Mesa 4", waiterName: "Nico" })).toEqual({
      tableName: null,
      waiterName: null,
    });
  });

  it("en mesa, un nombre vacío queda en null y no en cadena vacía", () => {
    // Para que "las ventas que tienen mesa" se pueda preguntar por null y no
    // haya que acordarse de filtrar strings vacíos en cada consulta.
    expect(datosDeMesa({ channel: SaleChannel.TABLE, tableName: "   ", waiterName: "" })).toEqual({
      tableName: null,
      waiterName: null,
    });
  });

  it("en mesa, recorta los espacios de los costados", () => {
    expect(
      datosDeMesa({ channel: SaleChannel.TABLE, tableName: "  Mesa 4 ", waiterName: " Nico  " }),
    ).toEqual({ tableName: "Mesa 4", waiterName: "Nico" });
  });

  it("en mesa sin mozo, la mesa igual se guarda", () => {
    // Se puede cobrar una mesa sin que haya un mozo cargado; perder la mesa por
    // eso dejaría el ticket sin el único dato que el cliente reconoce.
    expect(datosDeMesa({ channel: SaleChannel.TABLE, tableName: "Barra 2" })).toEqual({
      tableName: "Barra 2",
      waiterName: null,
    });
  });
});
