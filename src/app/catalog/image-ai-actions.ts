"use server";

import { requireAdminSession } from "@/lib/auth";
import { getProductErrorMessage } from "@/lib/catalog-error-messages";
import { logError, logEvent } from "@/lib/logger";
import { getProductImageAiErrorMessage } from "@/lib/product-image-ai-error-messages";
import { generateProductImageOptions } from "@/modules/catalog/generate-product-images.use-case";
import { ProductImageAiError, type ProductImageAiErrorCode } from "@/modules/catalog/product-image-ai.errors";
import {
  decodeGeneratedImageCandidate,
  parseProductImageAiRequest,
} from "@/modules/catalog/product-image-ai.logic";
import { ProductError } from "@/modules/catalog/product.errors";
import { saveProductImage } from "@/modules/catalog/product-image.use-case";
import { revalidatePath } from "next/cache";

export type GenerateProductImageResult =
  | { ok: true; candidates: string[] }
  | { ok: false; code: ProductImageAiErrorCode; error: string; retryAfterSeconds?: number };

export async function generateProductImageOptionsAction(input: {
  productId: string;
  request: unknown;
}): Promise<GenerateProductImageResult> {
  const session = await requireAdminSession();
  const request = parseProductImageAiRequest(input.request);

  if (!input.productId || !request) {
    return { ok: false, code: "INVALID_REQUEST", error: "Describí cómo querés que quede la imagen." };
  }

  try {
    const result = await generateProductImageOptions({
      businessId: session.user.businessId,
      productId: input.productId,
      userId: session.user.id,
      request,
    });
    return { ok: true, candidates: result.candidates };
  } catch (error) {
    if (error instanceof ProductImageAiError) {
      return {
        ok: false,
        code: error.code,
        error: getProductImageAiErrorMessage(error.code),
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }

    await logError("product.image.ai.generate", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, mode: request.mode },
    });
    return { ok: false, code: "PROVIDER_UNAVAILABLE", error: "No pudimos generar la imagen. Intentá de nuevo." };
  }
}

export type ConfirmGeneratedProductImageResult = { ok: true; version: number } | { ok: false; error: string };

export async function confirmGeneratedProductImageAction(input: {
  productId: string;
  candidate: string;
}): Promise<ConfirmGeneratedProductImageResult> {
  const session = await requireAdminSession();
  const data = decodeGeneratedImageCandidate(input.candidate);

  if (!input.productId || !data) {
    return { ok: false, error: "La imagen generada no es válida. Generala de nuevo." };
  }

  try {
    const file = new File([new Uint8Array(data)], "foto-ia.webp", { type: "image/webp" });
    await saveProductImage({
      businessId: session.user.businessId,
      productId: input.productId,
      file,
      userId: session.user.id,
    });
    await logEvent("product.image.ai.confirm", "Foto generada confirmada", {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId, bytes: data.byteLength },
    });
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.image.ai.confirm", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId: input.productId },
    });
    return { ok: false, error: "No pudimos usar esa foto. Intentá de nuevo." };
  }

  revalidatePath("/catalog");
  revalidatePath("/sales/new");
  return { ok: true, version: Date.now() };
}
