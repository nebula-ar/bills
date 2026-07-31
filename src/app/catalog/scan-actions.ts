"use server";

import { Unit } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getProductErrorMessage } from "@/lib/catalog-error-messages";
import { logError } from "@/lib/logger";
import { parseQuantityInput } from "@/lib/quantity";
import { ProductError } from "@/modules/catalog/product.errors";
import { downloadDirectoryImage, lookupBarcodeInDirectory, type DirectorySuggestion } from "@/modules/catalog/barcode-directory";
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
  // Si no lo tenemos, va lo que sepa de ese código la base pública de productos:
  // nombre y foto, para no tener que tipear ni fotografiar nada.
  | { found: false; suggestion: DirectorySuggestion | null };

export async function lookupProductByCode(input: { code: string; branchId?: string | null }): Promise<LookupResult> {
  const session = await requireAdminSession();

  const product = await findProductByCode({
    businessId: session.user.businessId,
    branchId: input.branchId ?? null,
    code: input.code,
  });

  if (product) {
    return { found: true, product };
  }

  return { found: false, suggestion: await lookupBarcodeInDirectory(input.code) };
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
  // La foto sugerida no viaja por URL desde el navegador: se vuelve a preguntar
  // por el código acá. Una URL que manda el cliente es una dirección que elige
  // el cliente, y el que la pediría sería el servidor.
  const useDirectoryPhoto = text(formData, "directoryPhoto") === "1";

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

    // La foto sale de la base pública (buscada por el código) o del cuadro de la
    // cámara. Que falle no invalida el alta: el producto ya está creado.
    const file = useDirectoryPhoto ? await directoryPhoto(code) : photo instanceof File && photo.size > 0 ? photo : null;

    if (file) {
      try {
        await saveProductImage({
          businessId: session.user.businessId,
          productId: product.id,
          file,
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

async function directoryPhoto(code: string) {
  const suggestion = await lookupBarcodeInDirectory(code);
  return suggestion?.imageUrl ? await downloadDirectoryImage(suggestion.imageUrl) : null;
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
