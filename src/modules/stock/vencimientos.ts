/**
 * Avisos de vencimiento.
 *
 * Una fecha guardada que nadie mira no evitó nunca que se tire nada: lo que
 * sirve es el aviso. Lógica pura, sin base ni React.
 */

export type EstadoDeVencimiento = "sin-fecha" | "ok" | "pronto" | "hoy" | "vencido";

/** Días de anticipación con los que se empieza a avisar. */
export const AVISAR_DESDE_DIAS = 7;

/** El día calendario, sin hora: un vencimiento es un DÍA, no un instante. */
function aDia(fecha: Date): number {
  return Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
}

/**
 * Qué tan urgente es esta fecha.
 *
 * "hoy" y "vencido" se separan a propósito: son dos acciones distintas. Lo que
 * vence hoy se remata; lo vencido se tira. Mezclarlos termina en mercadería
 * vencida vendida.
 */
export function estadoDeVencimiento(vence: Date | null, hoy: Date): EstadoDeVencimiento {
  if (!vence) return "sin-fecha";

  const dias = Math.round((aDia(vence) - aDia(hoy)) / 86_400_000);

  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= AVISAR_DESDE_DIAS) return "pronto";

  return "ok";
}

/**
 * Ordena lo más urgente primero; lo que no vence, al final.
 *
 * Quien abre la pantalla quiere ver primero lo que tiene que resolver hoy, no
 * ponerse a buscarlo entre lo que está bien.
 *
 * No necesita saber qué día es: ordenar por fecha ascendente ya deja lo
 * vencido arriba y lo lejano abajo.
 */
export function ordenarPorUrgencia<T extends { expiresAt: Date | null }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => {
    if (!a.expiresAt && !b.expiresAt) return 0;
    if (!a.expiresAt) return 1;
    if (!b.expiresAt) return -1;

    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });
}

/** Etiqueta corta para la pantalla. */
export function textoDeVencimiento(estado: EstadoDeVencimiento): string {
  switch (estado) {
    case "vencido":
      return "Vencido";
    case "hoy":
      return "Vence hoy";
    case "pronto":
      return "Vence pronto";
    default:
      return "";
  }
}
