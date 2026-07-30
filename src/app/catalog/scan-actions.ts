"use server";

import { Unit } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getProductErrorMessage } from "@/lib/catalog-error-messages";
import { logError } from "@/lib/logger";
import { parseQuantityInput } from "@/lib/quantity";
import { ProductError } from "@/modules/catalog/product.errors";
import { saveProductImage } from "@/modules/catalog/product-image.use-case";
import {
  createScannedProduct,
  findProductByCode,
  type ScannedProduct,
} from "@/modules/catalog/scan-product.use-case";
import { revalidatePath } from "next/cache";

// Acciones del escáner. Devuelven resultado (no redirigen) porque la cámara está
// abierta a pantalla completa: una navegación la cerraría y habría que volver a
// pedir permiso y reenfocar.

export type LookupResult =
  | { found: true; product: ScannedProduct }
  | { found: false };

export async function lookupProductByCode(input: { code: string; branchId?: string | null }): Promise<LookupResult> {
  const session = await requireAdminSession();

  const product = await findProductByCode({
    businessId: session.user.businessId,
    branchId: input.branchId ?? null,
    code: input.code,
  });

  return product ? { found: true, product } : { found: false };
}

export type CreateScannedResult =
  | { ok: true; productId: string; name: string }
  | { ok: false; error: string };

export async function createProductFromScan(formData: FormData): Promise<CreateScannedResult> {
  const session = await requireAdminSession();

  const code = text(formData, "code");
  const name = text(formData, "name");
  const branchId = text(formData, "branchId");
  const price = money(text(formData, "price"));
  const costRaw = text(formData, "cost");
  const stockRaw = text(formData, "stock");
  const minStockRaw = text(formData, "minStock");
  const unit = parseUnit(text(formData, "unit"));

  if (!name) {
    return { ok: false, error: "Poné el nombre del producto." };
  }

  if (price === null || price <= 0) {
    return { ok: false, error: "Poné un precio de venta válido." };
  }

  const photo = formData.get("photo");

  try {
    const product = await createScannedProduct({
      businessId: session.user.businessId,
      branchId,
      code,
      name,
      price,
      cost: costRaw ? money(costRaw) : null,
      stock: stockRaw ? parseQuantityInput(stockRaw, unit) : null,
      minStock: minStockRaw ? parseQuantityInput(minStockRaw, unit) : null,
      unit,
      categoryId: text(formData, "categoryId") || null,
      userId: session.user.id,
    });

    // La foto sale del mismo cuadro de la cámara con el que se escaneó, así que
    // si vino, se guarda acá mismo. Que falle no invalida el alta.
    if (photo instanceof File && photo.size > 0) {
      try {
        await saveProductImage({
          businessId: session.user.businessId,
          productId: product.id,
          file: photo,
          userId: session.user.id,
        });
      } catch (error) {
        await logError("product.scan.photo", error, {
          businessId: session.user.businessId,
          userId: session.user.id,
          context: { productId: product.id },
        });
      }
    }

    revalidatePath("/catalog");
    revalidatePath("/sales/new");
    revalidatePath("/stock");

    return { ok: true, productId: product.id, name: product.name };
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.scan.create", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { code },
    });

    return { ok: false, error: "No pudimos crear el producto. Intentá de nuevo." };
  }
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function money(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseUnit(value: string): Unit {
  return (Object.values(Unit) as string[]).includes(value) ? (value as Unit) : Unit.UNIT;
}
