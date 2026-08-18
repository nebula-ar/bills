"use server";

import { Unit } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { getProductErrorMessage } from "@/lib/catalog-error-messages";
import { logError } from "@/lib/logger";
import { parseQuantityInput } from "@/lib/quantity";
import { createProductVariants } from "@/modules/catalog/create-variants.use-case";
import { ProductError } from "@/modules/catalog/product.errors";
import { parseAxisValues } from "@/modules/catalog/variants.logic";
import { revalidatePath } from "next/cache";

export type CreateVariantsResult = { ok: true; created: number } | { ok: false; error: string };

export async function createVariantsAction(formData: FormData): Promise<CreateVariantsResult> {
  const session = await requireAdminSession();

  const modelName = text(formData, "modelName");
  const price = money(text(formData, "price"));
  const unit = parseUnit(text(formData, "unit"));

  if (price === null || price <= 0) {
    return { ok: false, error: "Poné un precio de venta válido." };
  }

  // Dos ejes alcanzan para el 99% de la ropa: talle y color.
  const axes = [
    { name: "Talle", values: parseAxisValues(text(formData, "sizes")) },
    { name: "Color", values: parseAxisValues(text(formData, "colors")) },
  ];

  try {
    const result = await createProductVariants({
      businessId: session.user.businessId,
      branchId: text(formData, "branchId"),
      modelName,
      axes,
      price,
      cost: text(formData, "cost") ? money(text(formData, "cost")) : null,
      stockPerVariant: text(formData, "stock") ? parseQuantityInput(text(formData, "stock"), unit) : null,
      minStock: text(formData, "minStock") ? parseQuantityInput(text(formData, "minStock"), unit) : null,
      categoryId: text(formData, "categoryId") || null,
      unit,
      userId: session.user.id,
    });

    revalidatePath("/catalog");
    revalidatePath("/sales/new");

    return { ok: true, created: result.created };
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.variants.create", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
    });

    return { ok: false, error: "No pudimos crear las variantes. Intentá de nuevo." };
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
