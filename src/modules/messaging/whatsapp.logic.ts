// Armado de mensajes de WhatsApp.
//
// Todo el mundo acá manda el comprobante y el recordatorio de deuda por
// WhatsApp. Lo que rompe siempre es el número: la gente lo guarda como
// "011 15-5555-5555" y wa.me no entiende ni el 0 ni el 15. Normalizarlo es la
// mitad del trabajo de esta función.

// Los celulares argentinos, sin 0 ni 15, tienen 10 dígitos (área + abonado).
const NATIONAL_LENGTH = 10;
const COUNTRY_CODE = "54";
// El 9 después del código de país es lo que marca "es un celular" para WhatsApp.
const MOBILE_PREFIX = "9";

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");

  if (digits.length < 8) {
    return null;
  }

  // Prefijo de salida internacional marcado a mano.
  digits = digits.replace(/^00/, "");

  if (digits.startsWith(COUNTRY_CODE) && digits.length >= 12) {
    const rest = digits.slice(2);
    const local = rest.startsWith(MOBILE_PREFIX) ? rest.slice(1) : rest;
    return `${COUNTRY_CODE}${MOBILE_PREFIX}${local}`;
  }

  // 0 de larga distancia.
  digits = digits.replace(/^0/, "");

  // "11 15 5555 5555": el 15 se cuela entre el área y el abonado y sobran dos
  // dígitos. Se prueba cada largo de área posible (2 a 4) hasta que la cuenta
  // cierre en 10.
  if (digits.length === NATIONAL_LENGTH + 2) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }

  return `${COUNTRY_CODE}${MOBILE_PREFIX}${digits}`;
}

// Link a WhatsApp. Sin número válido igual se devuelve el link: abre la app y
// deja elegir el contacto, que es mejor que un botón muerto.
export function whatsappLink(phone: string | null | undefined, message: string): string {
  const normalized = normalizePhone(phone) ?? "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

export type ReceiptInput = {
  businessName: string;
  dateLabel: string;
  items: { description: string; quantity: string; total: number }[];
  total: number;
};

// Comprobante en texto plano: es lo que el cliente guarda en el chat y lo que
// muestra si después reclama algo.
export function receiptMessage(input: ReceiptInput): string {
  const lines = input.items.map((item) => `• ${item.quantity} × ${item.description}: ${money(item.total)}`);

  return [
    `*${input.businessName}*`,
    `Comprobante del ${input.dateLabel}`,
    "",
    ...lines,
    "",
    `*Total: ${money(input.total)}*`,
    "",
    "¡Gracias por tu compra!",
  ].join("\n");
}

export type DebtReminderInput = {
  businessName: string;
  customerName: string;
  balance: number;
};

// Recordatorio de fiado. Cordial a propósito: el que cobra con esto le va a
// seguir vendiendo a la misma persona mañana.
export function debtReminderMessage(input: DebtReminderInput): string {
  return [
    `Hola ${input.customerName}! Te escribimos de *${input.businessName}*.`,
    "",
    `Tenés un saldo pendiente de *${money(input.balance)}* en tu cuenta.`,
    "",
    "Cuando puedas pasá y lo arreglamos. ¡Gracias!",
  ].join("\n");
}
