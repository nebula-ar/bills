import { QUANTITY_SCALE, lineTotal } from "@/lib/quantity";
import type { Capability } from "@/lib/capabilities";

import {
  abrirOReusarComanda,
  agregarRenglon,
  agregarRenglonConOpciones,
  cancelarComanda,
  cerrarComandaCobrada,
  contarRenglonesEnCocina,
  findOpenOrder,
  findOrderForCheckout,
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
 * La comanda para precargar el cobro real. `null` = no hay nada que cobrar
 * (ya se cobró, se canceló, o no existe): la pantalla de cobro no tiene por
 * qué distinguir el motivo, solo decir que no hay nada.
 */
export async function getOrderForCheckout(businessId: string, orderId: string) {
  const comanda = await findOrderForCheckout(businessId, orderId);
  // Sin mesa no hay qué liberar al cobrar: no debería pasar (toda comanda nace
  // de una mesa), pero si pasara, no hay nada seguro que precargar.
  if (!comanda || comanda.items.length === 0 || !comanda.tableId) return null;

  return {
    id: comanda.id,
    branchId: comanda.branchId,
    tableId: comanda.tableId,
    tableName: comanda.table?.name ?? null,
    waiterName: comanda.staff?.name ?? null,
    items: comanda.items.map((item) => ({ productId: item.productId as string, quantity: item.quantity })),
  };
}

/**
 * Cierra la comanda después de cobrarla por el POS real: marca la venta,
 * libera la mesa. La plata, el stock y el costo ya quedaron bien en
 * `createSale`; esto es solo la parte que le toca al salón.
 *
 * Deliberadamente sin transacción con la venta: la plata ya se cobró y
 * devolvió éxito. Si cerrar la comanda falla, se reintenta el cierre solo —no
 * se vuelve a cobrar, que sería el doble cobro que hay que evitar siempre.
 */
export function closeOrderAfterSale(input: {
  orderId: string;
  tableId: string;
  saleId: string;
  total: number;
  tip: number;
  staffId: string;
}) {
  return cerrarComandaCobrada(input);
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
