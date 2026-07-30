import { Unit } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { createFullProduct, type CreateFullProductInput } from "./create-full-product.use-case";

// Alta y búsqueda de productos por código escaneado.
//
// El caso de uso real es el dueño parado frente a una caja de mercadería recién
// llegada: escanea, completa cuatro datos, escanea el siguiente. Todo lo que se
// pueda inferir o postergar, se posterga.

export type ScannedProduct = {
  id: string;
  name: string;
  unit: Unit;
  price: number | null;
  stock: number | null;
  imageVersion: number | null;
  active: boolean;
};

// Busca un producto por código de barras o SKU dentro del negocio. Se usa tanto
// al cargar (¿ya existe?) como al vender (¿qué es esto?).
export async function findProductByCode(input: {
  businessId: string;
  branchId?: string | null;
  code: string;
}): Promise<ScannedProduct | null> {
  const code = input.code.trim();

  if (!code) {
    return null;
  }

  const product = await prisma.product.findFirst({
    where: {
      businessId: input.businessId,
      deleted: false,
      OR: [{ barcode: code }, { sku: code }],
    },
    select: {
      id: true,
      name: true,
      unit: true,
      active: true,
      imageUpdatedAt: true,
      branchPrices: input.branchId
        ? { where: { branchId: input.branchId, deleted: false, active: true }, select: { price: true } }
        : false,
      stockLevels: input.branchId ? { where: { branchId: input.branchId }, select: { quantity: true } } : false,
    },
  });

  if (!product) {
    return null;
  }

  return {
    id: product.id,
    name: product.name,
    unit: product.unit,
    active: product.active,
    price: product.branchPrices?.[0]?.price ?? null,
    stock: product.stockLevels?.[0]?.quantity ?? null,
    imageVersion: product.imageUpdatedAt?.getTime() ?? null,
  };
}

// El alta por escaneo es el alta completa con un código adelante.
export type CreateScannedProductInput = Omit<CreateFullProductInput, "reason"> & { code: string };

export function createScannedProduct(input: CreateScannedProductInput) {
  return createFullProduct({ ...input, reason: "Alta por escaneo" });
}
