import type { Prisma } from "@/generated/prisma/client";
import { KdsStatus, OrderStatus, ProductKind, TableStatus } from "@/generated/prisma/enums";
import { lineTotal, QUANTITY_SCALE } from "@/lib/quantity";
import { prisma } from "@/lib/prisma";

/**
 * La comanda de una mesa: lo que se pidió y lo que se puede pedir.
 *
 * Todas las funciones piden `businessId` y lo bajan al `where`. No alcanza con
 * que el caso de uso valide antes: a este módulo llega la carta pública
 * (`/carta/<token>`), que NO tiene sesión, así que el id de comanda o de
 * renglón puede venir de un teléfono cualquiera. Con el filtro en la firma, el
 * compilador no deja escribir una pantalla nueva que se lo olvide.
 */

type Tx = Prisma.TransactionClient;

/**
 * Primera sentencia de cada transacción: la comanda existe y es de este negocio.
 *
 * Va ANTES de tocar nada, y no al final. Sin el ancla, un `orderId` ajeno
 * alcanzaba a insertar el renglón y recién moría en el `update` del total: la
 * transacción revertía —así que no había daño— pero el motivo quedaba
 * escondido en un rollback en vez de ser un "esto no es tuyo" explícito.
 */
async function anclarComanda(tx: Tx, orderId: string, businessId: string): Promise<void> {
  const comanda = await tx.order.findFirst({
    where: { id: orderId, businessId, deleted: false },
    select: { id: true },
  });

  if (!comanda) {
    throw new Error("ORDER_NOT_FOUND");
  }
}

export function findTable(businessId: string, tableId: string) {
  return prisma.table.findFirst({
    where: { id: tableId, businessId, deleted: false },
    select: {
      id: true,
      name: true,
      branchId: true,
      sectorId: true,
      status: true,
      sector: { select: { id: true, name: true } },
    },
  });
}

export function findOpenOrder(businessId: string, tableId: string) {
  return prisma.order.findFirst({
    where: { tableId, businessId, status: OrderStatus.OPEN, deleted: false },
    select: {
      id: true,
      number: true,
      subtotal: true,
      discount: true,
      tip: true,
      total: true,
      version: true,
      openedAt: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          unitPrice: true,
          quantity: true,
          total: true,
          note: true,
          kdsStatus: true,
          productId: true,
          // Sin esto la comanda dice "Capuccino $7.150" y nadie sabe por qué
          // sale más caro, ni con qué leche prepararlo.
          modifiers: { select: { id: true, name: true, priceDelta: true } },
        },
      },
    },
  });
}

/**
 * Lo que se puede pedir: mercadería y servicios con precio en ESTA sucursal.
 *
 * Los insumos quedan afuera (`kind: INGREDIENT`): la harina no se vende. Es el
 * precio de haber reusado Product para los insumos, y se paga acá.
 */
export async function findProductosVendibles(businessId: string, branchId: string) {
  const productos = await prisma.product.findMany({
    where: {
      businessId,
      deleted: false,
      kind: { not: ProductKind.INGREDIENT },
      branchPrices: { some: { branchId, active: true, deleted: false } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      unit: true,
      imageUpdatedAt: true,
      catalogSlug: true,
      category: { select: { id: true, name: true } },
      modifierGroups: { where: { deleted: false }, select: { id: true }, take: 1 },
      branchPrices: {
        where: { branchId, active: true, deleted: false },
        select: { price: true },
        take: 1,
      },
    },
  });

  return productos
    .filter((p) => p.branchPrices.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: p.branchPrices[0].price,
      categoria: p.category?.name ?? "Sin categoría",
      categoriaId: p.category?.id ?? null,
      imageVersion: p.imageUpdatedAt?.getTime() ?? null,
      catalogSlug: p.catalogSlug,
      tieneOpciones: p.modifierGroups.length > 0,
    }));
}

/**
 * Abre la comanda de la mesa, o devuelve la que ya está abierta.
 *
 * Va en una transacción con el numerador porque dos mozos tocando la misma
 * mesa a la vez es lo normal en un salón, no un caso raro.
 */
export function abrirOReusarComanda(input: {
  businessId: string;
  branchId: string;
  tableId: string;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const abierta = await tx.order.findFirst({
      where: { tableId: input.tableId, status: OrderStatus.OPEN, deleted: false },
      select: { id: true },
    });
    if (abierta) return abierta;

    const ultima = await tx.order.findFirst({
      where: { businessId: input.businessId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const orden = await tx.order.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        tableId: input.tableId,
        staffId: input.staffId,
        number: (ultima?.number ?? 0) + 1,
        createdById: input.staffId,
      },
      select: { id: true },
    });

    // Sentar la mesa al abrir: si no, el tablero la muestra libre con consumo.
    await tx.table.update({
      where: { id: input.tableId, businessId: input.businessId },
      data: { status: TableStatus.OCCUPIED, updatedById: input.staffId },
    });

    return orden;
  });
}

/**
 * La comanda para precargar el cobro real (POS), igual que un turno o un
 * presupuesto. Solo lo abierto: una comanda ya cobrada o cancelada no tiene
 * nada que precargar.
 */
export function findOrderForCheckout(businessId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, businessId, status: OrderStatus.OPEN, deleted: false },
    select: {
      id: true,
      branchId: true,
      tableId: true,
      table: { select: { name: true } },
      staff: { select: { name: true } },
      items: {
        where: { kdsStatus: { not: KdsStatus.CART } },
        select: { productId: true, quantity: true },
      },
    },
  });
}

/**
 * Cierra la comanda después de cobrarla por el POS de verdad: la venta ya
 * quedó grabada con sus pagos, su stock y su costo (eso lo hizo `createSale`),
 * acá solo se deja constancia de qué comanda fue y se libera la mesa.
 */
export function cerrarComandaCobrada(input: {
  orderId: string;
  businessId: string;
  tableId: string;
  saleId: string;
  total: number;
  tip: number;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await anclarComanda(tx, input.orderId, input.businessId);

    await tx.order.update({
      where: { id: input.orderId, businessId: input.businessId },
      data: {
        status: OrderStatus.PAID,
        saleId: input.saleId,
        total: input.total,
        tip: input.tip,
        closedAt: new Date(),
        updatedById: input.staffId,
      },
    });

    await tx.table.update({
      where: { id: input.tableId, businessId: input.businessId },
      data: { status: TableStatus.FREE, updatedById: input.staffId },
    });
  });
}

export function findPrecioEnSucursal(productId: string, branchId: string) {
  return prisma.branchProductPrice.findFirst({
    where: { productId, branchId, active: true, deleted: false },
    select: { price: true, product: { select: { name: true, unit: true } } },
  });
}

/**
 * Agrega un renglón y recalcula el total de la comanda, todo junto.
 *
 * `version` sube en cada cambio: es lo que deja detectar que otro dispositivo
 * tocó la misma comanda mientras esta pantalla mostraba datos viejos.
 */
export function agregarRenglon(input: {
  orderId: string;
  businessId: string;
  productId: string;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
  note: string | null;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Fusiona con un renglón sin opciones del mismo producto que siga en
    // borrador y tenga la misma nota: tres toques a "Medialuna" son una fila
    // con cantidad 3, no tres filas iguales que hay que sumar a ojo. Con
    // opciones o nota distinta entra aparte, porque ahí "lo mismo" ya no es
    // obvio —una nota corta puede ser para ESE consumo, no para todos.
    await anclarComanda(tx, input.orderId, input.businessId);

    const existente = await tx.orderItem.findFirst({
      where: {
        orderId: input.orderId,
        order: { businessId: input.businessId },
        productId: input.productId,
        kdsStatus: KdsStatus.CART,
        note: input.note,
        modifiers: { none: {} },
      },
      select: { id: true, quantity: true, unitPrice: true },
    });

    if (existente) {
      const nuevaCantidad = existente.quantity + input.quantity;
      await tx.orderItem.update({
        where: { id: existente.id },
        data: { quantity: nuevaCantidad, total: lineTotal(existente.unitPrice, nuevaCantidad) },
      });
    } else {
      await tx.orderItem.create({
        data: {
          orderId: input.orderId,
          productId: input.productId,
          description: input.description,
          unitPrice: input.unitPrice,
          quantity: input.quantity,
          total: input.total,
          note: input.note,
          // Nace en BORRADOR, no en cocina. Antes cada toque mandaba el renglón
          // derecho al cocinero: el mozo no podía revisar el pedido con el
          // cliente antes de que empezaran a prepararlo, y una equivocación ya
          // era materia prima gastada. Ahora se junta el pedido y se confirma
          // entero (ver confirmarCarrito).
          kdsStatus: KdsStatus.CART,
        },
      });
    }

    // El total cuenta SOLO lo confirmado: un borrador todavía no se pidió, y
    // si sumara, el cajero podría cobrar un pedido que la cocina nunca vio.
    const renglones = await tx.orderItem.findMany({
      where: {
        orderId: input.orderId,
        order: { businessId: input.businessId },
        kdsStatus: { not: KdsStatus.CART },
      },
      select: { total: true },
    });
    const subtotal = renglones.reduce((suma, r) => suma + r.total, 0);

    await tx.order.update({
      where: { id: input.orderId, businessId: input.businessId },
      data: { subtotal, total: subtotal, version: { increment: 1 }, updatedById: input.staffId },
    });
  });
}

/**
 * Baja una unidad de un renglón en borrador. Si llega a cero, lo borra.
 *
 * Solo toca CART: un renglón ya confirmado es materia prima que la cocina
 * ya vio, y bajarle unidades ahí sin dejar rastro sería la misma pérdida sin
 * justificar que ya se resuelve con permiso de anulación en otro lado.
 */
export function restarUnidadRenglon(input: {
  orderId: string;
  businessId: string;
  itemId: string;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await anclarComanda(tx, input.orderId, input.businessId);

    const item = await tx.orderItem.findFirst({
      where: {
        id: input.itemId,
        orderId: input.orderId,
        order: { businessId: input.businessId },
        kdsStatus: KdsStatus.CART,
      },
      select: { quantity: true, unitPrice: true },
    });
    if (!item) return;

    const nuevaCantidad = item.quantity - QUANTITY_SCALE;

    if (nuevaCantidad <= 0) {
      // El renglón ya quedó atado a la comanda de este negocio por el
      // `findFirst` de arriba: si no fuera suyo, no habría `item` y esto no
      // llega a ejecutarse.
      await tx.orderItem.delete({ where: { id: input.itemId } });
    } else {
      await tx.orderItem.update({
        where: { id: input.itemId },
        data: { quantity: nuevaCantidad, total: lineTotal(item.unitPrice, nuevaCantidad) },
      });
    }

    await tx.order.update({
      where: { id: input.orderId, businessId: input.businessId },
      data: { version: { increment: 1 }, updatedById: input.staffId },
    });
  });
}

export function quitarRenglon(input: {
  orderId: string;
  businessId: string;
  itemId: string;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await anclarComanda(tx, input.orderId, input.businessId);

    await tx.orderItem.deleteMany({
      where: { id: input.itemId, orderId: input.orderId, order: { businessId: input.businessId } },
    });

    // Mismo criterio que al agregar: el total es lo confirmado.
    const renglones = await tx.orderItem.findMany({
      where: {
        orderId: input.orderId,
        order: { businessId: input.businessId },
        kdsStatus: { not: KdsStatus.CART },
      },
      select: { total: true },
    });
    const subtotal = renglones.reduce((suma, r) => suma + r.total, 0);

    await tx.order.update({
      where: { id: input.orderId, businessId: input.businessId },
      data: { subtotal, total: subtotal, version: { increment: 1 }, updatedById: input.staffId },
    });
  });
}

export function contarRenglonesEnCocina(orderId: string, businessId: string) {
  return prisma.orderItem.count({
    where: { orderId, order: { businessId }, kdsStatus: { notIn: [KdsStatus.CART] } },
  });
}

export function cancelarComanda(input: {
  orderId: string;
  businessId: string;
  tableId: string;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await anclarComanda(tx, input.orderId, input.businessId);

    await tx.order.update({
      where: { id: input.orderId, businessId: input.businessId },
      data: {
        status: OrderStatus.CANCELLED,
        closedAt: new Date(),
        version: { increment: 1 },
        updatedById: input.staffId,
      },
    });
    await tx.table.update({
      where: { id: input.tableId, businessId: input.businessId },
      data: { status: TableStatus.FREE, updatedById: input.staffId },
    });
  });
}

/** Igual que `agregarRenglon`, pero con las opciones elegidas y su copia. */
export function agregarRenglonConOpciones(input: {
  orderId: string;
  businessId: string;
  productId: string;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
  note: string | null;
  opciones: { modifierId: string; name: string; priceDelta: number }[];
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await anclarComanda(tx, input.orderId, input.businessId);

    await tx.orderItem.create({
      data: {
        orderId: input.orderId,
        productId: input.productId,
        description: input.description,
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        total: input.total,
        note: input.note,
        // Igual que `agregarRenglon`: nace en borrador y se manda a cocina
        // cuando el mozo confirma el pedido entero.
        kdsStatus: KdsStatus.CART,
        modifiers: { create: input.opciones },
      },
    });

    const renglones = await tx.orderItem.findMany({
      where: {
        orderId: input.orderId,
        order: { businessId: input.businessId },
        kdsStatus: { not: KdsStatus.CART },
      },
      select: { total: true },
    });
    const subtotal = renglones.reduce((suma, r) => suma + r.total, 0);

    await tx.order.update({
      where: { id: input.orderId, businessId: input.businessId },
      data: { subtotal, total: subtotal, version: { increment: 1 }, updatedById: input.staffId },
    });
  });
}

/** Manda a cocina lo que el cliente cargó por el QR. */
export function confirmarCarrito(orderId: string, businessId: string, staffId: string) {
  return prisma.$transaction(async (tx) => {
    await anclarComanda(tx, orderId, businessId);

    await tx.orderItem.updateMany({
      where: { orderId, order: { businessId }, kdsStatus: KdsStatus.CART },
      data: { kdsStatus: KdsStatus.PENDING, sentToKitchenAt: new Date() },
    });

    const renglones = await tx.orderItem.findMany({
      where: { orderId, order: { businessId }, kdsStatus: { not: KdsStatus.CART } },
      select: { total: true },
    });
    const subtotal = renglones.reduce((suma, r) => suma + r.total, 0);

    await tx.order.update({
      where: { id: orderId, businessId },
      data: { subtotal, total: subtotal, version: { increment: 1 }, updatedById: staffId },
    });
  });
}

/** Descarta lo que el cliente cargó y no se va a preparar. */
export function descartarCarrito(orderId: string, businessId: string) {
  // Sin `order: { businessId }` esto era un borrado por id pelado, y es de las
  // pocas funciones del módulo que NO pasa por un update de la comanda: no
  // había ninguna red debajo que lo atajara.
  return prisma.orderItem.deleteMany({
    where: { orderId, order: { businessId }, kdsStatus: KdsStatus.CART },
  });
}
