import type { Capability } from "@/lib/capabilities";

/**
 * Reglas de la comanda de salón. Lógica pura, sin base ni React.
 *
 * Una comanda se diferencia de una venta de mostrador en que existe un rato
 * largo antes de cobrarse, y en ese rato la toca gente distinta —el mozo que
 * la abre, la cocina que prepara, el cajero que cobra— a veces desde
 * dispositivos distintos y al mismo tiempo. De ahí que las reglas de quién
 * puede qué, y hasta cuándo, valgan la pena escribirlas aparte y probarlas.
 */

/**
 * Tope de unidades por renglón.
 *
 * No es un número mágico: es el freno a que 9999 medialunas entren a cocina
 * por un dedo apoyado en el botón, o por un pedido armado a mano contra el
 * endpoint público del QR.
 */
export const MAX_UNIDADES_POR_LINEA = 99;

export type ComandaLike = {
  /** Renglones ya mandados a cocina (o sea, materia prima gastada). */
  itemsEnCocina: number;
  /** Pagos ya registrados contra esta comanda. */
  pagos: number;
};

/**
 * Por qué NO se puede cancelar esta comanda. `null` = se puede.
 *
 * Tres escalones, y el del medio es el que hubo que corregir: la primera
 * versión pedía permiso de anulación para cancelar CUALQUIER comanda, y eso
 * rompía el caso más común y más inocente —el mozo abrió la mesa por error, o
 * los clientes se fueron antes de pedir—, obligándolo a buscar al encargado
 * por una pavada.
 */
export function motivoParaNoCancelar(
  comanda: ComandaLike,
  capacidades: readonly Capability[],
): string | null {
  if (!capacidades.includes("waitTables")) {
    return "No tenés permiso para manejar comandas";
  }

  // Cancelar borraría del arqueo plata ya cobrada. Lo correcto es anular la
  // venta, que deja rastro; cancelar no deja nada.
  if (comanda.pagos > 0) {
    return "La comanda ya tiene pagos registrados: hay que anular la venta, no cancelarla";
  }

  // Ya se gastó materia prima: descartarlo es una pérdida que alguien tiene
  // que poder justificar.
  if (comanda.itemsEnCocina > 0 && !capacidades.includes("refund")) {
    return "La comanda ya tiene ítems en cocina: necesitás permiso de anulación";
  }

  return null;
}

/**
 * Valida cuánto se agrega a un renglón. Devuelve el motivo del rechazo, o
 * null.
 *
 * `yaCargado` es lo que ese renglón ya tiene: el tope se mide ACUMULADO. Un
 * límite por toque no limita nada, porque se llega al mismo lugar sumando de
 * a uno.
 */
export function validarCantidad(yaCargado: number, aAgregar: number): string | null {
  if (!Number.isInteger(aAgregar)) {
    // El salón vende unidades enteras; el peso es cosa del mostrador.
    return "La cantidad tiene que ser un número entero";
  }
  if (aAgregar <= 0) {
    // Una cantidad negativa era otra forma de bajar el total de la comanda.
    return "La cantidad tiene que ser mayor que cero";
  }
  if (yaCargado + aAgregar > MAX_UNIDADES_POR_LINEA) {
    return `No se pueden cargar más de ${MAX_UNIDADES_POR_LINEA} unidades del mismo producto`;
  }

  return null;
}

export type RenglonLike = { total: number };

/**
 * Subtotal y total de la comanda, en pesos enteros.
 *
 * La propina NO entra en el subtotal: el subtotal es lo que vendió el negocio,
 * la propina es del mozo. Mezclarlas infla la facturación con plata ajena.
 *
 * Y el descuento se aplica solo contra lo vendido, nunca contra la propina:
 * un descuento que da el negocio no puede pagarse con la propina de otro.
 */
export function totalesDeComanda(
  renglones: RenglonLike[],
  descuento: number,
  propina: number,
): { subtotal: number; total: number } {
  const subtotal = renglones.reduce((suma, r) => suma + r.total, 0);
  const vendido = Math.max(0, subtotal - descuento);

  return { subtotal, total: vendido + propina };
}
