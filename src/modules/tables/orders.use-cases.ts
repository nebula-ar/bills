import { QUANTITY_SCALE, lineTotal } from "@/lib/quantity";
import type { Capability } from "@/lib/capabilities";

import {
  abrirOReusarComanda,
  agregarRenglon,
  agregarRenglonConOpciones,
  cancelarComanda,
  contarRenglonesEnCocina,
  findOpenOrder,
  findPrecioEnSucursal,
  quitarRenglon,
} from "./orders.repository";
import { motivoParaNoCancelar, totalesDeComanda, validarCantidad } from "./order-lifecycle";
import { effectiveUnitPrice, validarSeleccion } from "@/modules/catalog/modifiers";
import { findGruposDeProducto } from "@/modules/catalog/modifiers.repository";

/**
 * Tomar el pedido de una mesa.
 *
 * Las reglas duras (cuánto se puede cargar, quién puede cancelar, cómo se
 * suman los totales) viven en `order-lifecycle.ts` y se prueban solas. Acá se
 * las aplica contra la base.
 */

export type Resultado = { ok: true } | { ok: false; error: string };

export async function agregarProducto(input: {
  businessId: string;
  branchId: string;
  tableId: string;
  productId: string;
  unidades: number;
  note: string | null;
  staffId: string;
}): Promise<Resultado> {
  const comandaActual = await findOpenOrder(input.tableId);

  // El tope se mide sobre lo que ESE renglón ya tiene, no por toque: un límite
  // por toque no limita nada, se llega igual sumando de a uno.
  const yaCargado = (comandaActual?.items ?? [])
    .filter((i) => i.productId === input.productId)
    .reduce((suma, i) => suma + i.quantity / QUANTITY_SCALE, 0);

  const problema = validarCantidad(yaCargado, input.unidades);
  if (problema) return { ok: false, error: problema };

  const precio = await findPrecioEnSucursal(input.productId, input.branchId);
  if (!precio) return { ok: false, error: "Ese producto no tiene precio en esta sucursal" };

  const orden = await abrirOReusarComanda({
    businessId: input.businessId,
    branchId: input.branchId,
    tableId: input.tableId,
    staffId: input.staffId,
  });

  const quantity = input.unidades * QUANTITY_SCALE;

  await agregarRenglon({
    orderId: orden.id,
    productId: input.productId,
    // Copia del nombre: si el producto cambia o se borra, la comanda vieja
    // tiene que seguir diciendo qué se pidió.
    description: precio.product.name,
    unitPrice: precio.price,
    quantity,
    total: lineTotal(precio.price, quantity),
    note: input.note?.trim() || null,
    staffId: input.staffId,
  });

  return { ok: true };
}

export async function quitarProducto(input: {
  tableId: string;
  itemId: string;
  staffId: string;
}): Promise<Resultado> {
  const comanda = await findOpenOrder(input.tableId);
  if (!comanda) return { ok: false, error: "Esta mesa no tiene una comanda abierta" };

  await quitarRenglon({ orderId: comanda.id, itemId: input.itemId, staffId: input.staffId });

  return { ok: true };
}

export async function cancelar(input: {
  tableId: string;
  capacidades: readonly Capability[];
  staffId: string;
}): Promise<Resultado> {
  const comanda = await findOpenOrder(input.tableId);
  if (!comanda) return { ok: false, error: "Esta mesa no tiene una comanda abierta" };

  const enCocina = await contarRenglonesEnCocina(comanda.id);

  // Tres escalones, no uno: una comanda vacía la cancela cualquier mozo, con
  // ítems en cocina hace falta permiso de anulación, y con pagos no se cancela
  // nunca. Ver order-lifecycle.
  const motivo = motivoParaNoCancelar({ itemsEnCocina: enCocina, pagos: 0 }, input.capacidades);
  if (motivo) return { ok: false, error: motivo };

  await cancelarComanda({ orderId: comanda.id, tableId: input.tableId, staffId: input.staffId });

  return { ok: true };
}

/** Totales de lo que hay cargado, para mostrar en pantalla. */
export function totalesDe(items: { total: number }[], discount = 0, tip = 0) {
  return totalesDeComanda(items, discount, tip);
}

/**
 * Agrega un producto CON opciones elegidas.
 *
 * La validación pasa por `validarSeleccion`, que recibe los grupos del producto
 * y la selección entera. Ahí está la regla que importa: un modificador solo se
 * acepta si su grupo está asignado a ESE producto. Sin eso, un pedido armado a
 * mano puede colgarle a un café una opción de ajuste negativo de otro producto
 * y dejar la cuenta en cero.
 */
export async function agregarProductoConOpciones(input: {
  businessId: string;
  branchId: string;
  tableId: string;
  productId: string;
  modifierIds: string[];
  note: string | null;
  staffId: string;
}): Promise<Resultado> {
  const grupos = await findGruposDeProducto(input.businessId, input.productId);

  const problema = validarSeleccion(grupos, input.modifierIds);
  if (problema) return { ok: false, error: problema };

  const precio = await findPrecioEnSucursal(input.productId, input.branchId);
  if (!precio) return { ok: false, error: "Ese producto no tiene precio en esta sucursal" };

  const elegidos = grupos
    .flatMap((g) => g.modifiers)
    .filter((m) => input.modifierIds.includes(m.id));

  // Con piso en cero: sin él, un ajuste negativo repetido arrastraba el total.
  const unitPrice = effectiveUnitPrice(precio.price, elegidos);

  const orden = await abrirOReusarComanda({
    businessId: input.businessId,
    branchId: input.branchId,
    tableId: input.tableId,
    staffId: input.staffId,
  });

  const quantity = QUANTITY_SCALE;

  await agregarRenglonConOpciones({
    orderId: orden.id,
    productId: input.productId,
    description: precio.product.name,
    unitPrice,
    quantity,
    total: lineTotal(unitPrice, quantity),
    note: input.note?.trim() || null,
    // Copia del nombre y del ajuste: editar un modificador no puede reescribir
    // una comanda vieja.
    opciones: elegidos.map((m) => ({ modifierId: m.id, name: m.name, priceDelta: m.priceDelta })),
    staffId: input.staffId,
  });

  return { ok: true };
}
