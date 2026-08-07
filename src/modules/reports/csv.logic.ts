// Armado de CSV para el contador.
//
// Separador `;` y no `,`: el Excel en español interpreta la coma como decimal y
// abre todo en una sola columna. Los importes van con coma decimal por el mismo
// motivo. Esto no es capricho — es la diferencia entre que el contador abra el
// archivo o lo devuelva.

export const CSV_SEPARATOR = ";";

// Excel no detecta UTF-8 sin el BOM y rompe todas las tildes.
export const CSV_BOM = "﻿";

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  // Se entrecomilla solo lo necesario; las comillas internas se duplican.
  if (text.includes(CSV_SEPARATOR) || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return CSV_BOM + rows.map((row) => row.map(csvCell).join(CSV_SEPARATOR)).join("\r\n");
}

// Los importes son enteros en pesos (ver src/lib/money.ts), pero la planilla
// espera un número con coma decimal.
export function csvMoney(value: number): string {
  return `${value},00`;
}

export function csvDate(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function csvDateTime(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${csvDate(date)} ${hours}:${minutes}`;
}
