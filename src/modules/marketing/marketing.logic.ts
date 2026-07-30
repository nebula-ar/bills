// Lógica de marketing. Pura y testeable: acá no hay Prisma ni `new Date()`
// implícito — el "ahora" siempre entra por parámetro.
//
// La idea de fondo: el negocio ya tiene los datos (quién compró, cuándo, cuánto
// y su teléfono). Marketing es leerlos y decir a quién conviene escribirle hoy.

const DAY_MS = 24 * 60 * 60 * 1000;

export type CustomerActivity = {
  id: string;
  name: string;
  phone: string | null;
  // Última compra. null = nunca compró.
  lastPurchaseAt: Date | null;
  purchaseCount: number;
  totalSpent: number;
  birthday: Date | null;
};

export function daysSince(date: Date, now: Date): number {
  return Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
}

// Cuántos días sin comprar se considera "se está yendo". No es lo mismo un
// kiosco (donde el cliente pasa cada semana) que una barbería (cada 3 o 4
// semanas), así que el umbral entra por parámetro y la pantalla lo deja mover.
export const DEFAULT_LAPSED_DAYS = 45;

export type LapsedCustomer = CustomerActivity & { daysAway: number };

// Los que compraron alguna vez y hace rato que no vuelven, del que hace más
// tiempo al que hace menos: el primero de la lista es el más urgente.
//
// Los que nunca compraron quedan afuera a propósito: no se "recupera" a alguien
// que nunca vino, ese es otro problema.
export function lapsedCustomers(
  customers: CustomerActivity[],
  now: Date,
  thresholdDays = DEFAULT_LAPSED_DAYS,
): LapsedCustomer[] {
  return customers
    .filter((customer) => customer.lastPurchaseAt !== null)
    .map((customer) => ({ ...customer, daysAway: daysSince(customer.lastPurchaseAt as Date, now) }))
    .filter((customer) => customer.daysAway >= thresholdDays)
    .sort((a, b) => b.daysAway - a.daysAway);
}

// Los que más gastaron. Es la lista para avisar primero cuando llega algo bueno.
export function topCustomers(customers: CustomerActivity[], limit = 10): CustomerActivity[] {
  return [...customers]
    .filter((customer) => customer.totalSpent > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent || b.purchaseCount - a.purchaseCount)
    .slice(0, limit);
}

export type Birthday = CustomerActivity & { day: number; turnsToday: boolean };

// Cumpleaños del mes. Se compara solo día y mes: el año casi nunca lo cargan y
// tampoco importa para saludar.
export function birthdaysInMonth(customers: CustomerActivity[], now: Date): Birthday[] {
  const month = now.getMonth();

  return customers
    .filter((customer) => customer.birthday !== null)
    .filter((customer) => (customer.birthday as Date).getMonth() === month)
    .map((customer) => {
      const day = (customer.birthday as Date).getDate();
      return { ...customer, day, turnsToday: day === now.getDate() };
    })
    .sort((a, b) => a.day - b.day);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes
// ─────────────────────────────────────────────────────────────────────────────

function money(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

// Primer nombre: "Hola Rodrigo" suena a persona; "Hola Rodrigo Pérez", a banco.
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

// Los mensajes son plantillas, no envíos automáticos: los manda el dueño desde
// su WhatsApp, de a uno. Ver la nota en whatsapp.logic.ts.
export function winBackMessage(input: {
  businessName: string;
  customerName: string;
  daysAway: number;
  // Texto de la promo vigente, si hay alguna que ofrecerle.
  offer?: string | null;
}): string {
  const lines = [
    `Hola ${firstName(input.customerName)}! Te escribimos de *${input.businessName}*.`,
    "",
    `Hace un tiempo que no te vemos y queríamos saber cómo andás.`,
  ];

  if (input.offer) {
    lines.push("", input.offer);
  }

  lines.push("", "¡Te esperamos!");

  return lines.join("\n");
}

export function birthdayMessage(input: { businessName: string; customerName: string; offer?: string | null }): string {
  const lines = [`¡Feliz cumple, ${firstName(input.customerName)}! 🎉`, "", `De parte de todo *${input.businessName}*.`];

  if (input.offer) {
    lines.push("", input.offer);
  }

  return lines.join("\n");
}

export function campaignMessage(input: {
  businessName: string;
  customerName: string;
  // Lo que el dueño escribió para esta campaña.
  body: string;
}): string {
  return [`Hola ${firstName(input.customerName)}!`, "", input.body, "", `— *${input.businessName}*`].join("\n");
}

export function reviewMessage(input: { businessName: string; customerName: string; url: string }): string {
  return [
    `Hola ${firstName(input.customerName)}! Gracias por tu compra en *${input.businessName}*.`,
    "",
    "Si tenés un minuto, nos ayuda muchísimo que dejes tu reseña acá:",
    input.url,
    "",
    "¡Gracias!",
  ].join("\n");
}

export function loyaltyMessage(input: {
  businessName: string;
  customerName: string;
  points: number;
  value: number;
}): string {
  return [
    `Hola ${firstName(input.customerName)}!`,
    "",
    `Tenés *${input.points} puntos* acumulados en ${input.businessName}, que son ${money(input.value)} de descuento.`,
    "",
    "Podés usarlos en tu próxima compra.",
  ].join("\n");
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
