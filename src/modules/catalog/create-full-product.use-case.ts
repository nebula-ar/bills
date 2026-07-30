import { ProductKind, StockMovementType, Unit } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { applyStockMovement } from "@/modules/stock/stock.repository";

import { ProductError, ProductErrorCode } from "./product.errors";

export type CreateFullProductInput = {
  businessId: string;
  branchId: string;
  // Código de barras o SKU. Vacío = alta a mano, sin código.
  code?: string;
  name: string;
  // null = todavía no le puso precio. El producto igual se crea con todo lo
  // demás; sin precio no se puede vender, pero el stock que ya contó no se tira.
  price: number | null;
  cost?: number | null;
  // Existencia inicial en milésimas. 0 o ausente = no se carga stock.
  stock?: number | null;
  unit?: Unit;
  categoryId?: string | null;
  minStock?: number | null;
  trackStock?: boolean;
  kind?: ProductKind;
  // Motivo del movimiento de existencia inicial, para que el libro cuente de
  // dónde salió.
  reason?: string;
  userId?: string | null;
};

// Crea el producto con TODO lo que hace falta para poder venderlo enseguida:
// el ítem del catálogo, su precio en la sucursal y la existencia inicial con su
// movimiento de stock. En una sola transacción, para no dejar a medias un
// producto sin precio (que después no aparece en el POS y nadie entiende por qué).
//
// La usan el escáner y el alta a mano. Es a propósito: quien carga sus
// productos por primera vez tiene que poder decir "tengo 12 de estos" ahí
// mismo, sin pasar por la pantalla de stock a buscarlos uno por uno.
export async function createFullProduct(input: CreateFullProductInput) {
  const name = input.name.trim();
  const code = (input.code ?? "").trim();

  if (!name) {
    throw new ProductError(ProductErrorCode.INVALID_PRODUCT_NAME);
  }

  if (input.price !== null && (!Number.isInteger(input.price) || input.price <= 0)) {
    throw new ProductError(ProductErrorCode.INVALID_PRICE);
  }

  if (input.cost != null && (!Number.isInteger(input.cost) || input.cost < 0)) {
    throw new ProductError(ProductErrorCode.INVALID_COST);
  }

  if (input.minStock != null && (!Number.isInteger(input.minStock) || input.minStock < 0)) {
    throw new ProductError(ProductErrorCode.INVALID_MIN_STOCK);
  }

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, businessId: input.businessId, deleted: false, active: true },
    select: { id: true },
  });

  if (!branch) {
    throw new ProductError(ProductErrorCode.BRANCH_NOT_FOUND);
  }

  // El código es único por negocio: si ya está, esto es una edición, no un alta.
  if (code) {
    const existing = await prisma.product.findFirst({
      where: { businessId: input.businessId, deleted: false, OR: [{ barcode: code }, { sku: code }] },
      select: { id: true },
    });

    if (existing) {
      throw new ProductError(ProductErrorCode.DUPLICATE_CODE);
    }
  }

  const trackStock = input.trackStock ?? true;
  const initialStock = input.stock ?? 0;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        businessId: input.businessId,
        name,
        barcode: code || null,
        kind: input.kind ?? ProductKind.GOOD,
        unit: input.unit ?? Unit.UNIT,
        cost: input.cost ?? null,
        minStock: input.minStock ?? null,
        categoryId: input.categoryId ?? null,
        trackStock,
        active: true,
        createdById: input.userId,
        updatedById: input.userId,
      },
      select: { id: true, name: true },
    });

    if (input.price !== null) {
      await tx.branchProductPrice.create({
        data: { branchId: branch.id, productId: created.id, price: input.price, active: true },
      });
    }

    if (trackStock && initialStock > 0) {
      await applyStockMovement(tx, {
        branchId: branch.id,
        productId: created.id,
        type: StockMovementType.INITIAL,
        quantity: initialStock,
        unitCost: input.cost ?? null,
        reason: input.reason ?? "Carga inicial",
        createdById: input.userId,
      });
    }

    return created;
  });

  await logEvent("product.create", `Producto creado: ${product.name}`, {
    businessId: input.businessId,
    userId: input.userId ?? undefined,
    context: { productId: product.id, code, price: input.price, stock: initialStock, branchId: branch.id },
  });

  return product;
}
