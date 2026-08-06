"use server";

import { ProductKind, Unit } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { parseQuantityInput } from "@/lib/quantity";
import { logError } from "@/lib/logger";
import { getProductErrorMessage } from "@/lib/catalog-error-messages";
import { createFullProduct } from "@/modules/catalog/create-full-product.use-case";
import { ProductError } from "@/modules/catalog/product.errors";
import { updateGlobalProduct } from "@/modules/catalog/update-product.use-case";
import { removeProductImage, saveProductImage } from "@/modules/catalog/product-image.use-case";
import { upsertBranchProductConfiguration } from "@/modules/catalog/upsert-branch-product-config.use-case";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const genericErrorMessage = "No pudimos guardar el ítem. Intentá de nuevo.";

export async function createProduct(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const name = parseRequiredString(formData, "name");
  const priceRaw = formData.get("price");
  const price = parsePrice(priceRaw);
  const priceEntered = typeof priceRaw === "string" && priceRaw.trim().length > 0;

  if (!branchId || !name) {
    redirectWithMessage("error", "Completá el nombre del ítem.", branchId ?? undefined);
  }

  if (priceEntered && !price) {
    redirectWithMessage("error", "Poné un precio válido para la sucursal.", branchId);
  }

  const costRaw = parseOptionalString(formData, "cost");
  const stockRaw = parseOptionalString(formData, "stock");
  // La cantidad se tipea en unidades y se guarda en milésimas, igual que todo
  // lo demás (ver src/lib/quantity.ts).
  const stock = stockRaw ? parseQuantityInput(stockRaw) : null;

  try {
    // Un solo camino: el ítem, su precio (si lo puso) y la existencia inicial
    // con su movimiento, todo en una transacción. Es lo que evita que después
    // tenga que ir a Stock a cargar producto por producto lo que ya sabía.
    await createFullProduct({
      businessId: session.user.businessId,
      branchId,
      name,
      price,
      cost: costRaw ? parseWholeAmount(costRaw) : null,
      stock,
      categoryId: parseOptionalString(formData, "categoryId") ?? null,
      trackStock: stock !== null && stock > 0,
      kind: stock !== null && stock > 0 ? ProductKind.GOOD : ProductKind.SERVICE,
      reason: "Carga inicial",
      userId: session.user.id,
    });
  } catch (error) {
    await handleProductActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage(
    "success",
    price ? "Ítem creado y habilitado en la sucursal." : "Ítem creado en el catálogo.",
    branchId,
  );
}

export async function saveBranchProductConfig(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const productId = parseRequiredString(formData, "productId");
  const price = parsePrice(formData.get("price"));
  const active = formData.get("active") === "on";

  if (!branchId || !productId || !price) {
    redirectWithMessage("error", "Completá un precio válido en pesos.", branchId ?? undefined);
  }

  try {
    await upsertBranchProductConfiguration({
      businessId: session.user.businessId,
      branchId,
      productId,
      price,
      active,
    });
  } catch (error) {
    await handleProductActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage("success", "Configuración de sucursal guardada.", branchId);
}

export async function updateProduct(formData: FormData) {
  const session = await requireAdminSession();

  const branchId = parseRequiredString(formData, "branchId");
  const productId = parseRequiredString(formData, "productId");
  const name = parseRequiredString(formData, "name");
  const description = parseOptionalString(formData, "description");
  const priceRaw = formData.get("price");
  const price = parsePrice(priceRaw);
  const configured = formData.get("configured") === "true";
  const active = formData.get("active") === "on";

  if (!branchId || !productId || !name) {
    redirectWithMessage("error", "Completá el nombre del ítem.", branchId ?? undefined);
  }

  const priceEntered = typeof priceRaw === "string" && priceRaw.trim().length > 0;
  const wantsConfig = configured || active || priceEntered;

  if (wantsConfig && !price) {
    redirectWithMessage("error", "Poné un precio válido para configurarlo o habilitarlo.", branchId);
  }

  try {
    await updateGlobalProduct({
      businessId: session.user.businessId,
      productId,
      name,
      description,
      ...parseCommercialFields(formData),
    });

    if (wantsConfig && price) {
      await upsertBranchProductConfiguration({ businessId: session.user.businessId, branchId, productId, price, active });
    }
  } catch (error) {
    await handleProductActionError(error, branchId, { businessId: session.user.businessId, userId: session.user.id });
  }

  redirectWithMessage("success", "Ítem actualizado.", branchId);
}

// Los campos comerciales solo llegan desde la pantalla de catálogo cuando el
// rubro los usa. Si el formulario no los mandó, se devuelven `undefined` para
// que el caso de uso no los pise.
function parseCommercialFields(formData: FormData) {
  if (formData.get("hasCommercialFields") !== "true") {
    return {};
  }

  const kindRaw = parseOptionalString(formData, "kind");
  const unitRaw = parseOptionalString(formData, "unit");
  const costRaw = parseOptionalString(formData, "cost");
  const minStockRaw = parseOptionalString(formData, "minStock");
  const packSizeRaw = parseOptionalString(formData, "packSize");
  const kind =
    kindRaw && (Object.values(ProductKind) as string[]).includes(kindRaw) ? (kindRaw as ProductKind) : undefined;

  return {
    kind,
    unit: unitRaw && (Object.values(Unit) as string[]).includes(unitRaw) ? (unitRaw as Unit) : undefined,
    sku: parseOptionalString(formData, "sku") ?? null,
    barcode: parseOptionalString(formData, "barcode") ?? null,
    cost: costRaw ? parseWholeAmount(costRaw) : null,
    // Se deduce del tipo en vez de preguntarse: un servicio no tiene existencias
    // y un producto físico sí, siempre. Preguntarlo aparte permitía guardar la
    // contradicción "servicio que descuenta stock", y en la práctica el tilde
    // estaba puesto en todos.
    trackStock: kind === undefined ? undefined : kind !== ProductKind.SERVICE,
    // El mínimo se tipea en unidades y se guarda en milésimas, igual que el stock.
    minStock: minStockRaw ? parseQuantityInput(minStockRaw) : null,
    // El bulto se cuenta en unidades enteras: media caja no existe.
    packSize: packSizeRaw ? parseWholeAmount(packSizeRaw) : null,
    packLabel: parseOptionalString(formData, "packLabel") ?? null,
    categoryId: parseOptionalString(formData, "categoryId") ?? null,
  };
}

function parseWholeAmount(value: string) {
  const amount = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isInteger(amount) && amount >= 0 ? amount : null;
}

function parseRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function parsePrice(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  // El precio llega con separador de miles ("28.000"): acá el punto siempre
  // separa miles, nunca decimales (ver src/lib/money.ts).
  const normalizedValue = value.trim().replace(/\./g, "").replace(",", ".");
  const price = Number(normalizedValue);

  return Number.isInteger(price) && price > 0 ? price : null;
}

async function handleProductActionError(
  error: unknown,
  branchId: string | undefined,
  meta: { businessId: string; userId: string },
): Promise<never> {
  if (error instanceof ProductError) {
    redirectWithMessage("error", getProductErrorMessage(error.code), branchId);
  }

  await logError("product.save", error, { businessId: meta.businessId, userId: meta.userId, context: { branchId: branchId ?? null } });
  redirectWithMessage("error", genericErrorMessage, branchId);
}

function redirectWithMessage(status: "error" | "success", message: string, branchId?: string): never {
  const params = new URLSearchParams({ status, message });

  if (branchId) {
    params.set("branchId", branchId);
  }

  redirect(`/catalog?${params.toString()}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Foto del producto
// ─────────────────────────────────────────────────────────────────────────────

export type ProductImageResult = { ok: true; version: number } | { ok: false; error: string };

// Se sube por separado del resto del formulario: así una foto pesada no arrastra
// (ni bloquea) la edición de nombre y precio, y el resultado vuelve sin recargar.
export async function uploadProductImage(formData: FormData): Promise<ProductImageResult> {
  const session = await requireAdminSession();

  const productId = parseRequiredString(formData, "productId");
  const file = formData.get("file");

  if (!productId || !(file instanceof File)) {
    return { ok: false, error: "Elegí una foto para subir." };
  }

  try {
    await saveProductImage({
      businessId: session.user.businessId,
      productId,
      file,
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.image.save", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId },
    });
    return { ok: false, error: "No pudimos guardar la foto. Intentá de nuevo." };
  }

  revalidatePath("/catalog");
  revalidatePath("/sales/new");

  // El `version` va en la URL de la imagen para saltear el caché del navegador.
  return { ok: true, version: Date.now() };
}

export async function deleteProductImage(productId: string): Promise<ProductImageResult> {
  const session = await requireAdminSession();

  try {
    await removeProductImage({ businessId: session.user.businessId, productId, userId: session.user.id });
  } catch (error) {
    if (error instanceof ProductError) {
      return { ok: false, error: getProductErrorMessage(error.code) };
    }

    await logError("product.image.remove", error, {
      businessId: session.user.businessId,
      userId: session.user.id,
      context: { productId },
    });
    return { ok: false, error: "No pudimos quitar la foto. Intentá de nuevo." };
  }

  revalidatePath("/catalog");
  revalidatePath("/sales/new");

  return { ok: true, version: Date.now() };
}
