import { StockMovementType } from "@/generated/prisma/enums";

/**
 * Cómo se lee un movimiento de stock en la ficha del producto.
 *
 * El enum de la base está en inglés y en jerga de sistema (`SALE_CANCELLED`,
 * `TRANSFER_OUT`). Acá se traduce a lo que el dueño diría, una sola vez y en un
 * lugar con tests, para que la ficha, el listado de stock y cualquier reporte
 * digan lo mismo. Si cada pantalla arma su propio texto, "ajuste" termina
 * llamándose de tres formas y nadie sabe si son lo mismo.
 */

export type LecturaDeMovimiento = {
  titulo: string;
  /** Entra, sale, o no mueve la aguja. Decide el signo y el color. */
  sentido: "entra" | "sale";
};

const POR_TIPO: Record<StockMovementType, LecturaDeMovimiento> = {
  INITIAL: { titulo: "Carga inicial", sentido: "entra" },
  PURCHASE: { titulo: "Ingreso por compra", sentido: "entra" },
  PURCHASE_CANCELLED: { titulo: "Compra anulada", sentido: "sale" },
  SALE: { titulo: "Venta", sentido: "sale" },
  SALE_CANCELLED: { titulo: "Venta anulada", sentido: "entra" },
  ADJUSTMENT: { titulo: "Ajuste de stock", sentido: "entra" },
  TRANSFER_IN: { titulo: "Entrada por transferencia", sentido: "entra" },
  TRANSFER_OUT: { titulo: "Salida por transferencia", sentido: "sale" },
  LOSS: { titulo: "Merma", sentido: "sale" },
  RETURN: { titulo: "Devolución del cliente", sentido: "entra" },
};

export function leerMovimiento(tipo: StockMovementType): LecturaDeMovimiento {
  return POR_TIPO[tipo];
}

/**
 * El signo que se muestra. Sale del NÚMERO guardado, no del tipo: un ajuste
 * puede sumar o restar, y `applyStockMovement` guarda la cantidad ya con su
 * signo. Deducirlo del tipo mostraría "+" en un ajuste que descontó.
 */
export function signoDe(cantidad: number): "+" | "−" | "" {
  if (cantidad > 0) return "+";
  if (cantidad < 0) return "−";
  return "";
}

/**
 * Quién lo hizo. `createdById` es opcional —los movimientos que genera el
 * sistema al vender no siempre lo traen— y ahí no se inventa un nombre: se
 * omite la línea. "por Sistema" haría creer que hay un usuario llamado así.
 */
export function autorDe(nombre: string | null | undefined) {
  const limpio = nombre?.trim();
  return limpio ? `por ${limpio}` : null;
}
