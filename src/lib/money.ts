// Parsea un monto en pesos ingresado por el usuario (formato es-AR).
// Los montos se guardan como enteros (pesos), sin centavos.
//   "1.000"     -> 1000   (el punto es separador de miles)
//   "1.234.567" -> 1234567
//   "1000"      -> 1000
//   "10,5"      -> null    (no permitimos centavos)
//   ""/"abc"    -> null
// Devuelve el entero tal cual (puede ser 0 o negativo); la regla de signo la
// aplica cada caso de uso (un gasto/transferencia exige > 0, un conteo permite 0).
export function parseAmountInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\./g, "").replace(",", ".");
  if (normalized === "") {
    return null;
  }
  const amount = Number(normalized);
  return Number.isInteger(amount) ? amount : null;
}

// Cómo se ve un monto mientras se tipea: con el separador de miles de acá.
//   "28000"  -> "28.000"
//   "28.000" -> "28.000"   (idempotente: se le puede pasar lo ya formateado)
//   "0028"   -> "28"       (los ceros a la izquierda no significan nada)
//   ""       -> ""
// Es la inversa de `parseAmountInput`, que después limpia los puntos.
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "") {
    return "";
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
