import { describe, expect, it } from "vitest";

import { csvCell, csvDate, csvDateTime, csvFilename, csvMoney, toCsv } from "./csv.logic";

describe("csvCell", () => {
  it("deja pasar el texto simple sin comillas", () => {
    expect(csvCell("Alfajor")).toBe("Alfajor");
  });

  it("entrecomilla lo que tiene el separador", () => {
    // Un nombre con punto y coma partiría la fila en dos columnas.
    expect(csvCell("Tornillo; autoperforante")).toBe('"Tornillo; autoperforante"');
  });

  it("duplica las comillas internas", () => {
    expect(csvCell('Caño 1/2"')).toBe('"Caño 1/2"""');
  });

  it("entrecomilla los saltos de línea", () => {
    expect(csvCell("Nota\ncon salto")).toBe('"Nota\ncon salto"');
  });

  it("convierte null y undefined en celda vacía", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("no rompe el cero", () => {
    expect(csvCell(0)).toBe("0");
  });
});

describe("toCsv", () => {
  it("arranca con el BOM para que Excel lea las tildes", () => {
    expect(toCsv([["Día"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("separa con punto y coma y corta con CRLF", () => {
    const csv = toCsv([
      ["Fecha", "Total"],
      ["01/07/2026", "1000,00"],
    ]);

    expect(csv.slice(1)).toBe("Fecha;Total\r\n01/07/2026;1000,00");
  });
});

describe("formatos", () => {
  it("escribe el importe con coma decimal", () => {
    expect(csvMoney(12_500)).toBe("12500,00");
  });

  it("escribe la fecha como la espera la planilla argentina", () => {
    expect(csvDate(new Date(2026, 6, 5))).toBe("05/07/2026");
  });

  it("agrega la hora cuando importa el momento", () => {
    expect(csvDateTime(new Date(2026, 6, 5, 9, 7))).toBe("05/07/2026 09:07");
  });

  it("nombra el archivo con el rango", () => {
    expect(csvFilename("ventas", new Date(2026, 6, 1), new Date(2026, 6, 31))).toBe(
      "ventas-2026-07-01_a_2026-07-31.csv",
    );
  });
});
