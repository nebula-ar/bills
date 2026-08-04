import { prisma } from "@/lib/prisma";

import { ProductImageAiError, ProductImageAiErrorCode } from "./product-image-ai.errors";
import { PRODUCT_IMAGE_AI_LEASE_MS, PRODUCT_IMAGE_AI_LIMIT } from "./product-image-ai.logic";

export function findProductForImageGeneration(productId: string, businessId: string) {
  return prisma.product.findFirst({
    where: { id: productId, businessId, deleted: false },
    select: {
      id: true,
      name: true,
      description: true,
      image: { select: { data: true, contentType: true } },
    },
  });
}

export async function claimImageGeneration(input: { businessId: string; day: string; now: Date }) {
  await prisma.aiImageDailyUsage.upsert({
    where: { businessId_day: { businessId: input.businessId, day: input.day } },
    create: { businessId: input.businessId, day: input.day },
    update: { day: input.day },
  });

  const leaseUntil = new Date(input.now.getTime() + PRODUCT_IMAGE_AI_LEASE_MS);
  const claimed = await prisma.aiImageDailyUsage.updateMany({
    where: {
      businessId: input.businessId,
      day: input.day,
      attempts: { lt: PRODUCT_IMAGE_AI_LIMIT },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: input.now } }],
    },
    data: { attempts: { increment: 1 }, lockedUntil: leaseUntil },
  });

  if (claimed.count === 1) return { leaseUntil };

  const usage = await prisma.aiImageDailyUsage.findUnique({
    where: { businessId_day: { businessId: input.businessId, day: input.day } },
    select: { attempts: true, lockedUntil: true },
  });

  if ((usage?.attempts ?? PRODUCT_IMAGE_AI_LIMIT) >= PRODUCT_IMAGE_AI_LIMIT) {
    throw new ProductImageAiError(ProductImageAiErrorCode.DAILY_LIMIT_REACHED);
  }

  const retryAfterSeconds = usage?.lockedUntil
    ? Math.max(1, Math.ceil((usage.lockedUntil.getTime() - input.now.getTime()) / 1000))
    : undefined;
  throw new ProductImageAiError(ProductImageAiErrorCode.GENERATION_IN_PROGRESS, retryAfterSeconds);
}

export function releaseImageGeneration(input: { businessId: string; day: string; leaseUntil: Date }) {
  // Igualamos también el vencimiento: un request viejo nunca puede liberar el
  // lock que tomó otro request después de que su lease venciera.
  return prisma.aiImageDailyUsage.updateMany({
    where: { businessId: input.businessId, day: input.day, lockedUntil: input.leaseUntil },
    data: { lockedUntil: null },
  });
}
