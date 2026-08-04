import { logEvent } from "@/lib/logger";

import { ProductImageAiError, ProductImageAiErrorCode } from "./product-image-ai.errors";
import {
  buildProductImagePrompt,
  imageUsageDay,
  PRODUCT_IMAGE_AI_MAX_CANDIDATE_BYTES,
  PRODUCT_IMAGE_AI_MODEL,
  type ProductImageAiRequest,
} from "./product-image-ai.logic";
import {
  claimImageGeneration,
  findProductForImageGeneration,
  releaseImageGeneration,
} from "./product-image-ai.repository";
import { requestOpenRouterImages } from "./openrouter-image.client";

type ProductForGeneration = Awaited<ReturnType<typeof findProductForImageGeneration>>;

export type GenerateProductImageDependencies = {
  apiKey: () => string | undefined;
  now: () => Date;
  findProduct: (productId: string, businessId: string) => Promise<ProductForGeneration>;
  claim: typeof claimImageGeneration;
  release: typeof releaseImageGeneration;
  requestImages: typeof requestOpenRouterImages;
  normalize: (data: Buffer) => Promise<Buffer>;
  audit: (event: string, message: string, meta: Parameters<typeof logEvent>[2]) => Promise<void>;
};

const defaultDependencies: GenerateProductImageDependencies = {
  apiKey: () => process.env.OPENROUTER_API_KEY,
  now: () => new Date(),
  findProduct: findProductForImageGeneration,
  claim: claimImageGeneration,
  release: releaseImageGeneration,
  requestImages: requestOpenRouterImages,
  normalize: normalizeCandidate,
  audit: logEvent,
};

export async function generateProductImageOptions(input: {
  businessId: string;
  productId: string;
  userId: string;
  request: ProductImageAiRequest;
}, dependencies: GenerateProductImageDependencies = defaultDependencies) {
  const apiKey = dependencies.apiKey();
  if (!apiKey) throw new ProductImageAiError(ProductImageAiErrorCode.CONFIG_MISSING);

  const product = await dependencies.findProduct(input.productId, input.businessId);
  if (!product) throw new ProductImageAiError(ProductImageAiErrorCode.PRODUCT_NOT_FOUND);
  if (input.request.mode === "enhance" && !product.image) {
    throw new ProductImageAiError(ProductImageAiErrorCode.SOURCE_IMAGE_REQUIRED);
  }

  const startedAt = dependencies.now();
  const day = imageUsageDay(startedAt);
  const { leaseUntil } = await dependencies.claim({ businessId: input.businessId, day, now: startedAt });

  try {
    const generated = await dependencies.requestImages({
      apiKey,
      prompt: buildProductImagePrompt({
        ...input.request,
        productName: product.name,
        productDescription: product.description,
      }),
      reference: input.request.mode === "enhance" && product.image
        ? { data: Buffer.from(product.image.data), contentType: product.image.contentType }
        : undefined,
    });

    const normalized = await Promise.all(generated.images.map((image) => dependencies.normalize(image.data)));
    const candidates = normalized.map((data) => `data:image/webp;base64,${data.toString("base64")}`);

    await dependencies.audit("product.image.ai.generate", `Imagen generada para ${product.name}`, {
      businessId: input.businessId,
      userId: input.userId,
      context: {
        productId: product.id,
        mode: input.request.mode,
        model: PRODUCT_IMAGE_AI_MODEL,
        candidates: candidates.length,
        costUsd: generated.cost,
        durationMs: Math.max(0, dependencies.now().getTime() - startedAt.getTime()),
        result: "success",
      },
    });

    return { candidates };
  } catch (error) {
    await dependencies.audit("product.image.ai.generate", `Falló la generación para ${product.name}`, {
      businessId: input.businessId,
      userId: input.userId,
      context: {
        productId: product.id,
        mode: input.request.mode,
        model: PRODUCT_IMAGE_AI_MODEL,
        result: "error",
        code: error instanceof ProductImageAiError ? error.code : "UNKNOWN",
      },
    });
    throw error;
  } finally {
    await dependencies.release({ businessId: input.businessId, day, leaseUntil });
  }
}

async function normalizeCandidate(original: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");

  try {
    for (const quality of [78, 68, 58, 48]) {
      const data = await sharp(original, { failOn: "error" })
        .rotate()
        .resize(512, 512, { fit: "cover", position: "centre" })
        .webp({ quality })
        .toBuffer();

      if (data.byteLength <= PRODUCT_IMAGE_AI_MAX_CANDIDATE_BYTES) return data;
    }
  } catch {
    // La respuesta remota se trata igual que cualquier archivo hostil: si Sharp
    // no puede decodificarla, no llega al navegador ni a la base.
  }

  throw new ProductImageAiError(ProductImageAiErrorCode.INVALID_PROVIDER_RESPONSE);
}
