// Validación de CUIT/DNI (Argentina). Lógica pura, sin DB: se testea con
// Vitest. Se reusa en el perfil fiscal del negocio, los datos del cliente al
// vender, y al armar el payload de AFIP/ARCA.

const CUIT_MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export type TaxIdValidation = { valid: boolean; kind: "CUIT" | "DNI" | null };

function cuitCheckDigit(digits: number[]): number | null {
  const sum = digits.slice(0, 10).reduce((acc, d, i) => acc + d * CUIT_MULTIPLIERS[i], 0);
  const mod = sum % 11;
  const verifier = 11 - mod;
  if (verifier === 11) return 0;
  if (verifier === 10) return null; // CUIT matemáticamente inválido
  return verifier;
}

/** Valida un CUIT (11 dígitos, con dígito verificador) o DNI (7-8 dígitos). */
export function validateTaxId(raw: string): TaxIdValidation {
  const digits = (raw ?? "").replace(/\D/g, "");

  if (digits.length === 11) {
    const nums = digits.split("").map(Number);
    const expected = cuitCheckDigit(nums);
    if (expected === null || expected !== nums[10]) {
      return { valid: false, kind: "CUIT" };
    }
    return { valid: true, kind: "CUIT" };
  }

  if (digits.length === 7 || digits.length === 8) {
    return { valid: true, kind: "DNI" };
  }

  return { valid: false, kind: null };
}

export type AfipDocument = { docTipo: number; docNro: number };

/**
 * Resuelve el tipo/número de documento AFIP (DocTipo/DocNro, WS spec 4.1.3)
 * a partir de un CUIT/DNI. Sin identificar → Consumidor Final (99/0).
 */
export function resolveAfipDocument(taxId: string | null | undefined): AfipDocument {
  const digits = (taxId ?? "").replace(/\D/g, "");
  const check = taxId ? validateTaxId(taxId) : { valid: false, kind: null };
  if (!check.valid) return { docTipo: 99, docNro: 0 };
  if (check.kind === "CUIT") return { docTipo: 80, docNro: Number(digits) };
  if (check.kind === "DNI") return { docTipo: 96, docNro: Number(digits) };
  return { docTipo: 99, docNro: 0 };
}
