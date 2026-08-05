import { ProductKind, Unit } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Insumos y recetas.
 *
 * Un insumo es un Product con `kind: INGREDIENT`: se le compra a un proveedor,
 * tiene stock y costo, pero nunca se vende. Reusar Product hace que el stock,
 * las compras y los proveedores ya funcionen para él sin escribir nada.
 */

export function findInsumos(businessId: string, branchId: string) {
  return prisma.product.findMany({
    where: { businessId, kind: ProductKind.INGREDIENT, deleted: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      cost: true,
      minStock: true,
      stockLevels: {
        where: { branchId },
        select: { quantity: true, expiresAt: true },
        take: 1,
      },
    },
  });
}

/** Productos que se elaboran: los que pueden tener receta. */
export function findElaborables(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, kind: { not: ProductKind.INGREDIENT }, deleted: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      receta: {
        select: {
          id: true,
          quantity: true,
          ingredient: { select: { id: true, name: true, unit: true, cost: true } },
        },
      },
    },
  });
}

export function crearInsumo(input: {
  businessId: string;
  name: string;
  unit: Unit;
  cost: number | null;
  minStock: number | null;
  userId: string;
}) {
  return prisma.product.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      kind: ProductKind.INGREDIENT,
      unit: input.unit,
      cost: input.cost,
      minStock: input.minStock,
      // Un insumo sin seguimiento de stock no sirve: todo el módulo existe
      // para saber cuánto queda.
      trackStock: true,
      createdById: input.userId,
    },
    select: { id: true },
  });
}

export function ponerEnReceta(input: { productId: string; ingredientId: string; quantity: number }) {
  return prisma.recipeItem.upsert({
    where: {
      productId_ingredientId: { productId: input.productId, ingredientId: input.ingredientId },
    },
    create: input,
    update: { quantity: input.quantity },
    select: { id: true },
  });
}

export function sacarDeReceta(recipeItemId: string) {
  return prisma.recipeItem.delete({ where: { id: recipeItemId }, select: { id: true } });
}

export function findReceta(businessId: string, productId: string) {
  return prisma.recipeItem.findMany({
    where: { productId, product: { businessId } },
    select: {
      id: true,
      quantity: true,
      ingredientId: true,
      ingredient: { select: { name: true, unit: true, cost: true } },
    },
  });
}

export function findStockDeInsumos(branchId: string, ingredientIds: string[]) {
  return prisma.stockLevel.findMany({
    where: { branchId, productId: { in: ingredientIds } },
    select: { productId: true, quantity: true },
  });
}

/**
 * Registra una tanda: suma el producto terminado y descuenta los insumos.
 *
 * Todo en una transacción: una producción a medias deja el stock mintiendo,
 * y el stock que miente es peor que no tener stock.
 */
export function registrarProduccion(input: {
  businessId: string;
  branchId: string;
  productId: string;
  unidades: number;
  consumo: { ingredienteId: string; cantidad: number }[];
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.production.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        quantity: input.unidades,
        staffId: input.staffId,
        createdById: input.staffId,
      },
    });

    // Lo producido entra al stock.
    await tx.stockLevel.upsert({
      where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
      create: { branchId: input.branchId, productId: input.productId, quantity: input.unidades },
      update: { quantity: { increment: input.unidades } },
    });

    // Y los insumos salen.
    for (const c of input.consumo) {
      await tx.stockLevel.upsert({
        where: { branchId_productId: { branchId: input.branchId, productId: c.ingredienteId } },
        create: { branchId: input.branchId, productId: c.ingredienteId, quantity: -c.cantidad },
        update: { quantity: { decrement: c.cantidad } },
      });
    }
  });
}

export function registrarMerma(input: {
  businessId: string;
  branchId: string;
  productId: string;
  cantidad: number;
  motivo: string;
  staffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.waste.create({
      data: {
        businessId: input.businessId,
        branchId: input.branchId,
        productId: input.productId,
        quantity: input.cantidad,
        reason: input.motivo,
        staffId: input.staffId,
        createdById: input.staffId,
      },
    });

    await tx.stockLevel.upsert({
      where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
      create: { branchId: input.branchId, productId: input.productId, quantity: -input.cantidad },
      update: { quantity: { decrement: input.cantidad } },
    });
  });
}

export function findMermas(businessId: string, branchId: string) {
  return prisma.waste.findMany({
    where: { businessId, branchId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      quantity: true,
      reason: true,
      createdAt: true,
      product: { select: { name: true, unit: true, cost: true, kind: true } },
    },
  });
}

export function findTodoLoQueSePuedeTirar(businessId: string) {
  return prisma.product.findMany({
    where: { businessId, deleted: false, trackStock: true },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: { id: true, name: true, unit: true, kind: true },
  });
}

/** Carga o limpia el vencimiento de lo que hay en la sucursal. */
export function ponerVencimiento(input: {
  branchId: string;
  productId: string;
  expiresAt: Date | null;
}) {
  return prisma.stockLevel.upsert({
    where: { branchId_productId: { branchId: input.branchId, productId: input.productId } },
    create: { branchId: input.branchId, productId: input.productId, expiresAt: input.expiresAt },
    update: { expiresAt: input.expiresAt },
    select: { id: true },
  });
}
