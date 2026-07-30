import { PaymentMethod } from "@/generated/prisma/enums";

// Etiquetas y orden de los métodos de pago, usados también como "cuentas" contables
// (de dónde entra/sale la plata) para el cierre de caja.
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.MERCADO_PAGO]: "Mercado Pago",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.ACCOUNT]: "Cuenta corriente",
  [PaymentMethod.OTHER]: "Otro",
};

// Las CUENTAS de plata: las que tienen saldo y entran al arqueo de caja.
// `ACCOUNT` (fiado) queda afuera a propósito — vender a cuenta no mete plata en
// la caja, genera un cargo en la cuenta del cliente hasta que lo pague.
export const PAYMENT_METHOD_ORDER: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.MERCADO_PAGO,
  PaymentMethod.TRANSFER,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.QR,
  PaymentMethod.OTHER,
];

// Formas de cobro que se le ofrecen al vendedor en el checkout: las cuentas de
// plata más, si el negocio tiene clientes, la cuenta corriente.
export function salePaymentMethods(allowAccount: boolean): PaymentMethod[] {
  return allowAccount ? [...PAYMENT_METHOD_ORDER, PaymentMethod.ACCOUNT] : PAYMENT_METHOD_ORDER;
}

// True si el método mueve plata real (y por lo tanto impacta en la caja).
export function movesCash(method: PaymentMethod): boolean {
  return method !== PaymentMethod.ACCOUNT;
}

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_ORDER.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

export function paymentMethodOptions(methods: PaymentMethod[]) {
  return methods.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));
}

export function parsePaymentMethodValue(value: unknown): PaymentMethod | null {
  return typeof value === "string" && (Object.values(PaymentMethod) as string[]).includes(value)
    ? (value as PaymentMethod)
    : null;
}
