import { PromotionScope, PromotionType } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";

import { PromotionError, PromotionErrorCode } from "./promotion.errors";
import {
  createPromotionRecord,
  findPromotionById,
  findPromotionsForManagement,
  setPromotionActive,
  softDeletePromotion,
  updatePromotionRecord,
  type PromotionWriteInput,
} from "./promotion.repository";

export { findActivePromotions } from "./promotion.repository";

export function getPromotionsForManagement(businessId: string) {
  return findPromotionsForManagement(businessId);
}

export async function createPromotion(input: PromotionWriteInput) {
  validate(input);

  const promotion = await createPromotionRecord(input);

  await logEvent("promotion.create", `Promoción creada: ${input.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { promotionId: promotion.id, type: input.type, scope: input.scope },
  });

  return promotion;
}

export async function updatePromotion(promotionId: string, input: PromotionWriteInput) {
  await requirePromotion(promotionId, input.businessId);
  validate(input);

  const promotion = await updatePromotionRecord(promotionId, input);

  await logEvent("promotion.update", `Promoción actualizada: ${input.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { promotionId },
  });

  return promotion;
}

export async function togglePromotion(promotionId: string, businessId: string, active: boolean, userId?: string | null) {
  const promotion = await requirePromotion(promotionId, businessId);

  await setPromotionActive(promotionId, active, userId);

  await logEvent("promotion.toggle", `Promoción ${active ? "activada" : "pausada"}: ${promotion.name}`, {
    businessId,
    userId: userId ?? undefined,
    context: { promotionId, active },
  });
}

export async function deletePromotion(promotionId: string, businessId: string, userId?: string | null) {
  const promotion = await requirePromotion(promotionId, businessId);

  // Borrado lógico: los descuentos ya aplicados apuntan acá y no queremos que
  // una venta vieja pierda la explicación de por qué salió más barata.
  await softDeletePromotion(promotionId, userId);

  await logEvent("promotion.delete", `Promoción eliminada: ${promotion.name}`, {
    businessId,
    userId: userId ?? undefined,
    context: { promotionId },
  });
}

async function requirePromotion(promotionId: string, businessId: string) {
  const promotion = await findPromotionById(promotionId, businessId);

  if (!promotion) {
    throw new PromotionError(PromotionErrorCode.PROMOTION_NOT_FOUND);
  }

  return promotion;
}

// Cada tipo de promo exige sus propios parámetros. Validar acá evita guardar
// promos que después no descuentan nada y nadie entiende por qué.
function validate(input: PromotionWriteInput) {
  if (!input.name.trim()) {
    throw new PromotionError(PromotionErrorCode.INVALID_NAME);
  }

  if (input.startsAt && input.endsAt && input.startsAt > input.endsAt) {
    throw new PromotionError(PromotionErrorCode.INVALID_DATE_RANGE);
  }

  if (input.scope !== PromotionScope.ALL && input.productIds.length === 0 && input.categoryIds.length === 0) {
    throw new PromotionError(PromotionErrorCode.SCOPE_NEEDS_TARGETS);
  }

  switch (input.type) {
    case PromotionType.PERCENT_OFF:
      if (!input.percentOff || !Number.isInteger(input.percentOff) || input.percentOff <= 0 || input.percentOff > 100) {
        throw new PromotionError(PromotionErrorCode.INVALID_PERCENT);
      }
      break;

    case PromotionType.FIXED_OFF:
      if (!input.fixedOff || !Number.isInteger(input.fixedOff) || input.fixedOff <= 0) {
        throw new PromotionError(PromotionErrorCode.INVALID_AMOUNT);
      }
      break;

    case PromotionType.NX_M:
      if (
        !input.buyQuantity ||
        !input.payQuantity ||
        !Number.isInteger(input.buyQuantity) ||
        !Number.isInteger(input.payQuantity) ||
        input.payQuantity <= 0 ||
        input.buyQuantity <= input.payQuantity
      ) {
        throw new PromotionError(PromotionErrorCode.INVALID_NX_M);
      }
      break;

    case PromotionType.BUNDLE_PRICE:
      if (!input.bundlePrice || !Number.isInteger(input.bundlePrice) || input.bundlePrice <= 0) {
        throw new PromotionError(PromotionErrorCode.INVALID_BUNDLE);
      }
      // Un combo se define por los productos que lo forman: sin al menos dos no
      // hay "combo" que valga.
      if (input.productIds.length < 2) {
        throw new PromotionError(PromotionErrorCode.BUNDLE_NEEDS_PRODUCTS);
      }
      break;
  }
}
