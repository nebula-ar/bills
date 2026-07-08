import { PaymentMethod } from "@/generated/prisma/client";

// Etiquetas y orden de los métodos de pago, usados también como "cuentas" contables
// (de dónde entra/sale la plata) para el cierre de caja.
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.MERCADO_PAGO]: "Mercado Pago",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.DEBIT_CARD]: "Débito",
  [PaymentMethod.CREDIT_CARD]: "Crédito",
  [PaymentMethod.QR]: "QR",
  [PaymentMethod.OTHER]: "Otro",
};

export const PAYMENT_METHOD_ORDER: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.MERCADO_PAGO,
  PaymentMethod.TRANSFER,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.QR,
  PaymentMethod.OTHER,
];

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_ORDER.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

export function parsePaymentMethodValue(value: unknown): PaymentMethod | null {
  return typeof value === "string" && (Object.values(PaymentMethod) as string[]).includes(value)
    ? (value as PaymentMethod)
    : null;
}
