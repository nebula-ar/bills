import { KdsStatus, OrderStatus, ProductKind, TableStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * La comanda de una mesa: lo que se pidió y lo que se puede pedir.
 */

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

export function findOpenOrder(tableId: string) {
  return prisma.order.findFirst({
    where: { tableId, status: OrderStatus.OPEN, deleted: false },
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
      where: { id: input.tableId },
      data: { status: TableStatus.OCCUPIED, updatedById: input.staffId },
    });

    return orden;
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
  productId: string;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
  note: string | null;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.orderItem.create({
      data: {
        orderId: input.orderId,
        productId: input.productId,
        description: input.description,
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        total: input.total,
        note: input.note,
        kdsStatus: KdsStatus.PENDING,
      },
    });

    const renglones = await tx.orderItem.findMany({
      where: { orderId: input.orderId },
      select: { total: true },
    });
    const subtotal = renglones.reduce((suma, r) => suma + r.total, 0);

    await tx.order.update({
      where: { id: input.orderId },
      data: {
        subtotal,
        total: subtotal,
        version: { increment: 1 },
        updatedById: input.staffId,
      },
    });
  });
}

export function quitarRenglon(input: { orderId: string; itemId: string; staffId: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { id: input.itemId, orderId: input.orderId } });

    const renglones = await tx.orderItem.findMany({
      where: { orderId: input.orderId },
      select: { total: true },
    });
    const subtotal = renglones.reduce((suma, r) => suma + r.total, 0);

    await tx.order.update({
      where: { id: input.orderId },
      data: { subtotal, total: subtotal, version: { increment: 1 }, updatedById: input.staffId },
    });
  });
}

export function contarRenglonesEnCocina(orderId: string) {
  return prisma.orderItem.count({
    where: { orderId, kdsStatus: { notIn: [KdsStatus.CART] } },
  });
}

export function cancelarComanda(input: { orderId: string; tableId: string; staffId: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: input.orderId },
      data: {
        status: OrderStatus.CANCELLED,
        closedAt: new Date(),
        version: { increment: 1 },
        updatedById: input.staffId,
      },
    });
    await tx.table.update({
      where: { id: input.tableId },
      data: { status: TableStatus.FREE, updatedById: input.staffId },
    });
  });
}
