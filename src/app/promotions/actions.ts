"use server";

import { AppModule, PromotionScope, PromotionType } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { getPromotionErrorMessageFor } from "@/lib/promotion-labels";
import { parseQuantityInput } from "@/lib/quantity";
import { PromotionError } from "@/modules/promotions/promotion.errors";
import type { PromotionWriteInput } from "@/modules/promotions/promotion.repository";
import { createPromotion, deletePromotion, togglePromotion, updatePromotion } from "@/modules/promotions/promotion.use-cases";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function int(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, ""));
  return Number.isInteger(parsed) ? parsed : null;
}

function date(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0) : null;
}

function promotionType(value: string): PromotionType {
  return (Object.values(PromotionType) as string[]).includes(value)
    ? (value as PromotionType)
    : PromotionType.PERCENT_OFF;
}

function promotionScope(value: string): PromotionScope {
  return (Object.values(PromotionScope) as string[]).includes(value) ? (value as PromotionScope) : PromotionScope.ALL;
}

function read(formData: FormData, businessId: string, userId: string): PromotionWriteInput {
  const scope = promotionScope(text(formData, "scope"));

  // El alcance decide qué targets valen: si la promo es de categorías, los
  // productos elegidos se descartan (y al revés).
  const productIds = scope === PromotionScope.PRODUCT ? formData.getAll("productIds").map(String).filter(Boolean) : [];
  const categoryIds =
    scope === PromotionScope.CATEGORY ? formData.getAll("categoryIds").map(String).filter(Boolean) : [];

  const weekdays = formData.getAll("weekdays").map(String).filter(Boolean);

  // Fin del día para que una promo que "termina el 31" valga todo el 31.
  const endsAt = date(text(formData, "endsAt"));
  if (endsAt) {
    endsAt.setHours(23, 59, 59, 999);
  }

  return {
    businessId,
    userId,
    name: text(formData, "name"),
    type: promotionType(text(formData, "type")),
    scope,
    percentOff: int(text(formData, "percentOff")),
    fixedOff: int(text(formData, "fixedOff")),
    buyQuantity: int(text(formData, "buyQuantity")),
    payQuantity: int(text(formData, "payQuantity")),
    bundlePrice: int(text(formData, "bundlePrice")),
    minQuantity: text(formData, "minQuantity") ? parseQuantityInput(text(formData, "minQuantity")) : null,
    minAmount: int(text(formData, "minAmount")),
    startsAt: date(text(formData, "startsAt")),
    endsAt,
    weekdays: weekdays.length > 0 && weekdays.length < 7 ? weekdays.join(",") : null,
    priority: int(text(formData, "priority")) ?? 0,
    active: formData.get("active") !== null,
    productIds,
    categoryIds,
    branchIds: formData.getAll("branchIds").map(String).filter(Boolean),
  };
}

export async function createPromotionAction(formData: FormData) {
  const { session } = await requireModule(AppModule.PROMOTIONS);

  try {
    await createPromotion(read(formData, session.user.businessId, session.user.id));
  } catch (error) {
    handle(error, "promotion.create", session.user.businessId, session.user.id);
  }

  back("success", "Promoción creada.");
}

export async function updatePromotionAction(formData: FormData) {
  const { session } = await requireModule(AppModule.PROMOTIONS);
  const promotionId = text(formData, "promotionId");

  try {
    await updatePromotion(promotionId, read(formData, session.user.businessId, session.user.id));
  } catch (error) {
    handle(error, "promotion.update", session.user.businessId, session.user.id);
  }

  back("success", "Promoción actualizada.");
}

export async function togglePromotionAction(formData: FormData) {
  const { session } = await requireModule(AppModule.PROMOTIONS);

  try {
    await togglePromotion(
      text(formData, "promotionId"),
      session.user.businessId,
      text(formData, "active") === "true",
      session.user.id,
    );
  } catch (error) {
    handle(error, "promotion.toggle", session.user.businessId, session.user.id);
  }

  back("success", "Listo.");
}

export type PromotionActionResult = { ok: boolean; message: string };

export async function deletePromotionAction(formData: FormData): Promise<PromotionActionResult> {
  const { session } = await requireModule(AppModule.PROMOTIONS);

  try {
    await deletePromotion(text(formData, "promotionId"), session.user.businessId, session.user.id);
  } catch (error) {
    return handleDelete(error, session.user.businessId, session.user.id);
  }

  return { ok: true, message: "Promoción eliminada." };
}

function handleDelete(error: unknown, businessId: string, userId: string): PromotionActionResult {
  if (error instanceof PromotionError) return { ok: false, message: getPromotionErrorMessageFor(error) };

  void logError("promotion.delete", error, { businessId, userId });
  return { ok: false, message: "No pudimos completar la operación. Intentá de nuevo." };
}

function handle(error: unknown, event: string, businessId: string, userId: string): never {
  if (error instanceof PromotionError) {
    back("error", getPromotionErrorMessageFor(error));
  }

  void logError(event, error, { businessId, userId });
  back("error", "No pudimos completar la operación. Intentá de nuevo.");
}

function back(status: "success" | "error", message: string): never {
  // La acción acabó de mutar datos y el redirect vuelve a la MISMA ruta: sin
  // invalidarla, el router del cliente puede servir el árbol que ya tenía y el
  // usuario ve el valor de antes (visto de verdad: un ajuste de stock a 50 que
  // seguía mostrando 111).
  revalidatePath("/promotions");

  redirect(`/promotions?${new URLSearchParams({ status, message }).toString()}`);
}
