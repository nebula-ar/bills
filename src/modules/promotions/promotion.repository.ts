import { prisma } from "@/lib/prisma";

import type { PromotionRule } from "./promotion.logic";

// Promos vigentes para una sucursal: las que corren en todas (sin filas en
// PromotionBranch) más las asignadas explícitamente a esta.
export async function findActivePromotions(businessId: string, branchId: string): Promise<PromotionRule[]> {
  const promotions = await prisma.promotion.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      OR: [{ branches: { none: {} } }, { branches: { some: { branchId } } }],
    },
    select: {
      id: true,
      name: true,
      type: true,
      scope: true,
      percentOff: true,
      fixedOff: true,
      buyQuantity: true,
      payQuantity: true,
      bundlePrice: true,
      minQuantity: true,
      minAmount: true,
      startsAt: true,
      endsAt: true,
      weekdays: true,
      priority: true,
      targets: { select: { productId: true, categoryId: true } },
    },
  });

  return promotions.map(toRule);
}

export function findPromotionsForManagement(businessId: string) {
  return prisma.promotion.findMany({
    where: { businessId, deleted: false },
    orderBy: [{ active: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      scope: true,
      percentOff: true,
      fixedOff: true,
      buyQuantity: true,
      payQuantity: true,
      bundlePrice: true,
      minQuantity: true,
      minAmount: true,
      startsAt: true,
      endsAt: true,
      weekdays: true,
      priority: true,
      active: true,
      targets: {
        select: {
          productId: true,
          categoryId: true,
          product: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
      branches: { select: { branchId: true, branch: { select: { name: true } } } },
      _count: { select: { discounts: true } },
    },
  });
}

export function findPromotionById(promotionId: string, businessId: string) {
  return prisma.promotion.findFirst({
    where: { id: promotionId, businessId, deleted: false },
    select: { id: true, name: true },
  });
}

export type PromotionWriteInput = {
  businessId: string;
  name: string;
  type: PromotionRule["type"];
  scope: PromotionRule["scope"];
  percentOff: number | null;
  fixedOff: number | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  bundlePrice: number | null;
  minQuantity: number | null;
  minAmount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  weekdays: string | null;
  priority: number;
  active: boolean;
  productIds: string[];
  categoryIds: string[];
  branchIds: string[];
  userId?: string | null;
};

export function createPromotionRecord(input: PromotionWriteInput) {
  return prisma.promotion.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      type: input.type,
      scope: input.scope,
      percentOff: input.percentOff,
      fixedOff: input.fixedOff,
      buyQuantity: input.buyQuantity,
      payQuantity: input.payQuantity,
      bundlePrice: input.bundlePrice,
      minQuantity: input.minQuantity,
      minAmount: input.minAmount,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      weekdays: input.weekdays,
      priority: input.priority,
      active: input.active,
      createdById: input.userId,
      updatedById: input.userId,
      targets: {
        create: [
          ...input.productIds.map((productId) => ({ productId })),
          ...input.categoryIds.map((categoryId) => ({ categoryId })),
        ],
      },
      branches: {
        create: input.branchIds.map((branchId) => ({ branchId })),
      },
    },
  });
}

// El alcance se reemplaza entero en cada edición: es más simple de razonar que
// un diff, y son pocas filas.
export function updatePromotionRecord(promotionId: string, businessId: string, input: PromotionWriteInput) {
  return prisma.$transaction(async (tx) => {
    // El alcance se borra por relación y no por `promotionId` pelado: si la
    // promo es de otro negocio no hay filas que borrar, y el update de abajo
    // tira antes de que la transacción confirme nada.
    await tx.promotionTarget.deleteMany({ where: { promotionId, promotion: { businessId } } });
    await tx.promotionBranch.deleteMany({ where: { promotionId, promotion: { businessId } } });

    return tx.promotion.update({
      where: { id: promotionId, businessId },
      data: {
        name: input.name,
        type: input.type,
        scope: input.scope,
        percentOff: input.percentOff,
        fixedOff: input.fixedOff,
        buyQuantity: input.buyQuantity,
        payQuantity: input.payQuantity,
        bundlePrice: input.bundlePrice,
        minQuantity: input.minQuantity,
        minAmount: input.minAmount,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        weekdays: input.weekdays,
        priority: input.priority,
        active: input.active,
        updatedById: input.userId,
        targets: {
          create: [
            ...input.productIds.map((productId) => ({ productId })),
            ...input.categoryIds.map((categoryId) => ({ categoryId })),
          ],
        },
        branches: {
          create: input.branchIds.map((branchId) => ({ branchId })),
        },
      },
    });
  });
}

export function softDeletePromotion(promotionId: string, businessId: string, userId?: string | null) {
  return prisma.promotion.update({
    where: { id: promotionId, businessId },
    data: { deleted: true, deletedAt: new Date(), deletedById: userId, active: false },
  });
}

export function setPromotionActive(promotionId: string, businessId: string, active: boolean, userId?: string | null) {
  return prisma.promotion.update({
    where: { id: promotionId, businessId },
    data: { active, updatedById: userId },
  });
}

type PromotionRow = {
  targets: { productId: string | null; categoryId: string | null }[];
} & Omit<PromotionRule, "productIds" | "categoryIds">;

function toRule(promotion: PromotionRow): PromotionRule {
  return {
    id: promotion.id,
    name: promotion.name,
    type: promotion.type,
    scope: promotion.scope,
    percentOff: promotion.percentOff,
    fixedOff: promotion.fixedOff,
    buyQuantity: promotion.buyQuantity,
    payQuantity: promotion.payQuantity,
    bundlePrice: promotion.bundlePrice,
    minQuantity: promotion.minQuantity,
    minAmount: promotion.minAmount,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    weekdays: promotion.weekdays,
    priority: promotion.priority,
    productIds: promotion.targets.flatMap((target) => (target.productId ? [target.productId] : [])),
    categoryIds: promotion.targets.flatMap((target) => (target.categoryId ? [target.categoryId] : [])),
  };
}
