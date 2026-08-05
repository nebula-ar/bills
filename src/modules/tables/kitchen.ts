import { KdsStatus } from "@/generated/prisma/enums";

import type { Capability } from "@/lib/capabilities";

/**
 * Pantalla de cocina (KDS): qué preparar y en qué orden.
 *
 * No es una pantalla de gestión. La mira el cocinero mientras trabaja, con las
 * manos ocupadas, de reojo y a un metro de distancia. Por eso lo que decide
 * qué se ve y con qué urgencia vive acá y se prueba, en vez de quedar repartido
 * por el componente.
 */

/** El recorrido de un renglón, en orden. */
const RECORRIDO: KdsStatus[] = [
  KdsStatus.CART,
  KdsStatus.PENDING,
  KdsStatus.PREPARING,
  KdsStatus.READY,
  KdsStatus.DELIVERED,
];

/** Las tres columnas del tablero. Entregado sale; carrito nunca entra. */
export const COLUMNAS_COCINA = [
  KdsStatus.PENDING,
  KdsStatus.PREPARING,
  KdsStatus.READY,
] as const;

/**
 * ¿Este renglón se muestra en la cocina?
 *
 * Quedan afuera los dos extremos, por motivos distintos:
 *  - CART lo cargó el cliente desde el QR y el mozo todavía no lo confirmó. Si
 *    llegara a cocina se prepararía comida que nadie pidió en firme: alcanza
 *    con que alguien juegue con el menú mientras espera.
 *  - DELIVERED ya salió. Si se quedara, la cocina terminaría el turno mirando
 *    una pantalla llena de cosas entregadas y perdería de vista lo que falta.
 */
export function enTablero(estado: KdsStatus): boolean {
  return (COLUMNAS_COCINA as readonly KdsStatus[]).includes(estado);
}

/** Estado siguiente al tocar "avanzar". Entregado es el final. */
export function siguienteEstado(estado: KdsStatus): KdsStatus {
  const i = RECORRIDO.indexOf(estado);
  if (i < 0) return KdsStatus.PENDING;

  return RECORRIDO[Math.min(i + 1, RECORRIDO.length - 1)];
}

/**
 * ¿Puede avanzar este renglón con estas capacidades?
 *
 * Confirmar el carrito del QR es del MOZO, no del cocinero: el mozo es quien ve
 * la mesa y decide que el pedido va en firme. Dejar que la cocina lo confirme
 * sola saltea ese control.
 */
export function puedeAvanzar(estado: KdsStatus, capacidades: readonly Capability[]): boolean {
  if (estado === KdsStatus.DELIVERED) return false;

  if (estado === KdsStatus.CART) return capacidades.includes("waitTables");

  return capacidades.includes("kitchen");
}

/** Reparte los renglones en las columnas del tablero. */
export function repartirEnColumnas<T extends { kdsStatus: KdsStatus }>(
  items: T[],
): Record<string, T[]> {
  const columnas: Record<string, T[]> = {
    [KdsStatus.PENDING]: [],
    [KdsStatus.PREPARING]: [],
    [KdsStatus.READY]: [],
  };

  for (const item of items) {
    if (enTablero(item.kdsStatus)) columnas[item.kdsStatus].push(item);
  }

  return columnas;
}

/**
 * Hace cuánto que espera.
 *
 * Bajo la hora, `m:ss` con los segundos corriendo: en vivo, un número quieto
 * parece pantalla colgada. Pasada la hora, `Hh MMm`, porque "132 minutos" no
 * le dice nada a nadie a un metro de distancia.
 */
export function textoDeEspera(enviadoMs: number, ahoraMs: number): string {
  // Un reloj desfasado entre el salón y el servidor no puede mostrar negativos.
  const segundos = Math.max(0, Math.floor((ahoraMs - enviadoMs) / 1000));
  const minutos = Math.floor(segundos / 60);

  if (minutos >= 60) {
    const horas = Math.floor(minutos / 60);
    return `${horas}h ${String(minutos % 60).padStart(2, "0")}m`;
  }

  return `${minutos}:${String(segundos % 60).padStart(2, "0")}`;
}

export type NivelDeDemora = "normal" | "atencion" | "urgente";

/**
 * Semáforo de demora contra el tiempo estimado de preparación.
 *
 * Sin estimado usa 10 minutos: la mayoría de los productos no lo tiene cargado
 * (en Migas, 6 de 56), así que sin un default el semáforo no serviría para casi
 * nada. Un estimado en cero o negativo cae en ese mismo default en vez de
 * dividir por nada y dejar todo en rojo.
 */
export function nivelDeDemora(minutosEsperando: number, minutosEstimados: number | null): NivelDeDemora {
  const estimado = minutosEstimados && minutosEstimados > 0 ? minutosEstimados : 10;

  if (minutosEsperando >= estimado * 1.5) return "urgente";
  if (minutosEsperando >= estimado) return "atencion";

  return "normal";
}
