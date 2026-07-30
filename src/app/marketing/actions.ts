"use server";

import { AppModule } from "@/generated/prisma/client";
import { requireModule } from "@/lib/business-context";
import { logError } from "@/lib/logger";
import { getMarketingErrorMessage } from "@/lib/marketing-error-messages";
import { MarketingError } from "@/modules/marketing/marketing.errors";
import { redeemPoints, updateMarketingSettings } from "@/modules/marketing/marketing.use-cases";
import { revalidatePath } from "next/cache";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, ""));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export type SaveSettingsResult = { ok: true } | { ok: false; error: string };

export async function saveMarketingSettingsAction(formData: FormData): Promise<SaveSettingsResult> {
  const { session } = await requireModule(AppModule.MARKETING);

  try {
    await updateMarketingSettings({
      businessId: session.user.businessId,
      publicPageActive: formData.get("publicPageActive") === "on",
      publicNote: text(formData, "publicNote"),
      googleReviewUrl: text(formData, "googleReviewUrl") || null,
      pointsPerAmount: positiveInt(text(formData, "pointsPerAmount")),
      pointValue: positiveInt(text(formData, "pointValue")),
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof MarketingError) {
      return { ok: false, error: getMarketingErrorMessage(error.code) };
    }

    await logError("marketing.settings", error, { businessId: session.user.businessId, userId: session.user.id });
    return { ok: false, error: "No pudimos guardar la configuración." };
  }

  revalidatePath("/marketing");
  return { ok: true };
}

export type RedeemResult = { ok: true; points: number; value: number } | { ok: false; error: string };

export async function redeemPointsAction(input: {
  customerId: string;
  branchId: string;
  points: number;
}): Promise<RedeemResult> {
  const { session } = await requireModule(AppModule.MARKETING);

  try {
    const result = await redeemPoints({
      businessId: session.user.businessId,
      customerId: input.customerId,
      points: input.points,
      branchId: input.branchId || null,
      userId: session.user.id,
    });

    // El canje deja crédito en la cuenta del cliente y baja su saldo de puntos.
    revalidatePath("/customers");
    revalidatePath("/marketing");

    return { ok: true, points: result.points, value: result.value };
  } catch (error) {
    if (error instanceof MarketingError) {
      return { ok: false, error: getMarketingErrorMessage(error.code) };
    }

    await logError("marketing.loyalty.redeem", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { customerId: input.customerId },
    });
    return { ok: false, error: "No pudimos registrar el canje." };
  }
}
