// Programa de puntos. Lógica pura.
//
// Reglas del negocio, en dos números que el dueño configura:
//   `pointsPerAmount` → cada cuántos pesos se gana 1 punto ($1.000 → 1 punto)
//   `pointValue`      → cuánto vale 1 punto al canjear ($50 por punto)
//
// El saldo NUNCA se guarda: es la suma del libro de movimientos, igual que la
// cuenta corriente. Un total guardado se desincroniza el día que algo falla a
// mitad de camino; una suma no puede mentir.

export type LoyaltyRules = {
  pointsPerAmount: number | null;
  pointValue: number | null;
};

export function loyaltyEnabled(rules: LoyaltyRules): boolean {
  return (rules.pointsPerAmount ?? 0) > 0 && (rules.pointValue ?? 0) > 0;
}

// Puntos que deja una venta. Se redondea para abajo: no se regalan fracciones,
// y así el cliente nunca ve un número que no entiende.
export function pointsForSale(total: number, rules: LoyaltyRules): number {
  if (!loyaltyEnabled(rules) || total <= 0) {
    return 0;
  }

  return Math.floor(total / (rules.pointsPerAmount as number));
}

export function loyaltyBalance(entries: { points: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.points, 0);
}

// Cuánta plata representan esos puntos.
export function pointsValue(points: number, rules: LoyaltyRules): number {
  if (!loyaltyEnabled(rules)) {
    return 0;
  }

  return Math.max(points, 0) * (rules.pointValue as number);
}

export const RedeemError = {
  DISABLED: "DISABLED",
  INVALID_POINTS: "INVALID_POINTS",
  NOT_ENOUGH_POINTS: "NOT_ENOUGH_POINTS",
} as const;

export type RedeemError = (typeof RedeemError)[keyof typeof RedeemError];

export type RedeemCheck = { ok: true; points: number; value: number } | { ok: false; error: RedeemError };

// Valida un canje antes de tocar la base. No se puede canjear más de lo que
// hay: el saldo de puntos no se va a negativo (a diferencia de la cuenta
// corriente, donde deber es parte del negocio).
export function checkRedeem(points: number, balance: number, rules: LoyaltyRules): RedeemCheck {
  if (!loyaltyEnabled(rules)) {
    return { ok: false, error: RedeemError.DISABLED };
  }

  if (!Number.isInteger(points) || points <= 0) {
    return { ok: false, error: RedeemError.INVALID_POINTS };
  }

  if (points > balance) {
    return { ok: false, error: RedeemError.NOT_ENOUGH_POINTS };
  }

  return { ok: true, points, value: pointsValue(points, rules) };
}
