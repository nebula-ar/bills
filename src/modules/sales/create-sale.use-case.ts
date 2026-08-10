import { PaymentMethod, Unit, UserRole } from "@/generated/prisma/client";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { allowsFraction, lineTotal, QUANTITY_SCALE } from "@/lib/quantity";
import { validateTaxId } from "@/lib/tax-id";
import { assertCanChargeToAccount } from "@/modules/customers/customer.use-cases";
import { applyPromotions, type CartLine } from "@/modules/promotions/promotion.logic";
import { findActivePromotions } from "@/modules/promotions/promotion.repository";
import { pointsForSale } from "@/modules/marketing/loyalty.logic";
import { findAverageCosts, findStockLevels } from "@/modules/stock/stock.repository";

import type { CreateSaleDto } from "./create-sale.dto";
import {
  createSaleTransaction,
  findBranchProductPrices,
  findSaleBranch,
  findSaleStaff,
  type CreateSaleRepositoryItem,
} from "./sale.repository";
import { datosDeMesa } from "./sale-channel.logic";
import { SaleError, SaleErrorCode } from "./sale.errors";

// Una venta pasa por cinco pasos, en este orden y por este motivo:
//   1. Se arman los renglones a precio de lista (el precio lo manda el catálogo,
//      nunca el cliente del POS).
//   2. Se aplican las promociones vigentes sobre ese carrito.
//   3. Se chequea que haya stock de lo que descuenta stock.
//   4. Se valida que los pagos cierren contra el total YA con descuento.
//   5. Recién ahí se graba todo junto (venta + stock + fiado) en una transacción.
export async function createSale(input: CreateSaleDto) {
  validateSaleInputShape(input);

  const [branch, staff, productPrices, averageCosts] = await Promise.all([
    findSaleBranch(input.branchId),
    findSaleStaff(input.staffId),
    findBranchProductPrices(input.branchId, uniqueProductIds(input.items)),
    // El costo que se congela en el renglón es el promedio de ESTA sucursal, no
    // el último precio pagado: si no, vender mercadería vieja se costea al
    // precio de la última compra y el margen sale mal (ver costing.logic.ts).
    findAverageCosts(input.branchId, uniqueProductIds(input.items)),
  ]);

  if (!branch || branch.deleted) {
    throw new SaleError(SaleErrorCode.BRANCH_NOT_FOUND);
  }

  if (!staff || staff.deleted || !staff.active) {
    throw new SaleError(SaleErrorCode.STAFF_NOT_AVAILABLE);
  }

  if (staff.role !== UserRole.STAFF) {
    throw new SaleError(SaleErrorCode.STAFF_INVALID_ROLE);
  }

  if (staff.branchId !== input.branchId) {
    throw new SaleError(SaleErrorCode.STAFF_WRONG_BRANCH);
  }

  const priceByProductId = new Map(productPrices.map((price) => [price.productId, price]));

  // 1) Renglones a precio de lista.
  const draftItems = input.items.map((item) => {
    if (!item.productId) {
      // Ítem suelto ("extra"): el vendedor pone descripción y precio a mano.
      const description = item.description?.trim();

      if (!description) {
        throw new SaleError(SaleErrorCode.INVALID_MANUAL_EXTRA_DESCRIPTION);
      }

      if (!Number.isInteger(item.unitPrice) || !item.unitPrice || item.unitPrice <= 0) {
        throw new SaleError(SaleErrorCode.INVALID_MANUAL_EXTRA_PRICE);
      }

      return {
        productId: null,
        categoryId: null,
        description,
        quantity: item.quantity,
        unit: item.unit ?? Unit.UNIT,
        unitPrice: item.unitPrice,
        unitCost: null,
        trackStock: false,
      };
    }

    const price = priceByProductId.get(item.productId);

    if (!price) {
      throw new SaleError(SaleErrorCode.PRODUCT_NOT_AVAILABLE);
    }

    // Media unidad de algo que se vende entero no existe: daría un total mal
    // calculado y stock en fracciones que nadie puede reponer.
    if (!allowsFraction(price.product.unit) && item.quantity % QUANTITY_SCALE !== 0) {
      throw new SaleError(SaleErrorCode.FRACTIONAL_QUANTITY_NOT_ALLOWED, { productName: price.product.name });
    }

    return {
      productId: item.productId,
      categoryId: price.product.categoryId,
      description: price.product.name,
      quantity: item.quantity,
      unit: price.product.unit,
      unitPrice: price.price,
      // Sin promedio todavía (mercadería que entró antes del PPP, o producto
      // sin movimientos) cae al costo de reposición, que es lo único que hay.
      unitCost: averageCosts.get(item.productId) ?? price.product.cost,
      trackStock: price.product.trackStock,
    };
  });

  // 2) Promociones vigentes de la sucursal, sobre el carrito ya armado.
  const soldAt = input.soldAt ?? new Date();
  const promotions = await findActivePromotions(branch.businessId, input.branchId);
  const cart: CartLine[] = draftItems.map((item) => ({
    productId: item.productId,
    categoryId: item.categoryId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
  const priced = applyPromotions(cart, promotions, soldAt);

  const saleItems: CreateSaleRepositoryItem[] = draftItems.map((item, index) => {
    const discount = priced.discountByLine[index];

    return {
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount,
      unitCost: item.unitCost,
      trackStock: item.trackStock,
      total: lineTotal(item.unitPrice, item.quantity) - discount,
    };
  });

  // La propina se SUMA al total que se cobra y se valida: el arqueo cuenta lo
  // que entró al cajón, y ahí entra junto con el resto. No toca `subtotal` ni
  // `discountTotal`, que son la economía de la mercadería, no del mozo.
  const tip = Number.isInteger(input.tip) && (input.tip ?? 0) > 0 ? (input.tip as number) : 0;
  const saleTotal = priced.total + tip;

  // 3) Stock: si algo descuenta y no alcanza, frenamos antes de cobrar.
  if (!input.allowNegativeStock) {
    await assertStockAvailable(input.branchId, draftItems);
  }

  // 4) Pagos. La venta rápida cobra el total ya con el descuento aplicado.
  const payments =
    input.payments.length > 0
      ? input.payments
      : [{ method: input.autoPaymentMethod as PaymentMethod, amount: saleTotal }];

  const paymentsTotal = sum(payments.map((payment) => payment.amount));

  if (paymentsTotal !== saleTotal) {
    throw new SaleError(SaleErrorCode.PAYMENTS_TOTAL_MISMATCH);
  }

  const accountCharge = sum(
    payments.filter((payment) => payment.method === PaymentMethod.ACCOUNT).map((payment) => payment.amount),
  );

  if (accountCharge > 0) {
    if (!input.customerId) {
      throw new SaleError(SaleErrorCode.ACCOUNT_REQUIRES_CUSTOMER);
    }

    // Tira si el cliente no existe, está inactivo o se pasa del límite de crédito.
    await assertCanChargeToAccount({
      customerId: input.customerId,
      businessId: branch.businessId,
      amount: accountCharge,
    });
  }

  const customerTaxId = input.customerTaxId?.trim() || undefined;
  if (customerTaxId) {
    const check = validateTaxId(customerTaxId);
    if (!check.valid) {
      throw new SaleError(SaleErrorCode.INVALID_CUSTOMER_TAX_ID);
    }
  }

  // Puntos que deja esta venta. Si el programa está apagado da 0 y no se asienta
  // nada; si está prendido, el asiento entra con la venta y no después.
  const loyaltyPoints = input.customerId ? await pointsForThisSale(branch.businessId, saleTotal) : 0;

  // 5) Todo junto o nada.
  const sale = await createSaleTransaction({
    businessId: branch.businessId,
    loyaltyPoints,
    branchId: input.branchId,
    staffId: input.staffId,
    terminalId: input.terminalId ?? null,
    customerId: input.customerId ?? null,
    subtotal: priced.subtotal,
    discountTotal: priced.discountTotal,
    total: saleTotal,
    tip,
    items: saleItems,
    payments,
    discounts: priced.discounts.map((discount) => ({
      promotionId: discount.promotionId,
      description: discount.description,
      amount: discount.amount,
    })),
    accountCharge,
    notes: input.notes,
    soldAt: input.soldAt,
    customerName: input.customerName?.trim() || undefined,
    customerTaxId,
    customerTaxCondition: input.customerTaxCondition,
    channel: input.channel,
    // La regla de qué se guarda de mesa y mozo vive en su propio módulo, con
    // tests: es fácil de romper desde la pantalla y difícil de notar después.
    ...datosDeMesa(input),
    userId: input.userId,
  });

  await logEvent("sale.create", `Venta registrada por $${saleTotal}`, {
    businessId: branch.businessId,
    userId: input.userId ?? undefined,
    context: {
      saleId: sale.id,
      branchId: input.branchId,
      staffId: input.staffId,
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      total: saleTotal,
      items: saleItems.length,
      promotions: priced.discounts.length,
      accountCharge,
      terminalId: input.terminalId ?? null,
      loyaltyPoints,
    },
  });

  return sale;
}

// Chequea existencias sumando lo pedido por producto: dos renglones del mismo
// producto compiten por el mismo stock.
async function assertStockAvailable(
  branchId: string,
  items: { productId: string | null; trackStock: boolean; quantity: number; description: string }[],
) {
  const needed = new Map<string, { quantity: number; description: string }>();

  for (const item of items) {
    if (!item.productId || !item.trackStock) {
      continue;
    }

    const current = needed.get(item.productId);

    needed.set(item.productId, {
      quantity: (current?.quantity ?? 0) + item.quantity,
      description: item.description,
    });
  }

  if (needed.size === 0) {
    return;
  }

  const levels = await findStockLevels(branchId, [...needed.keys()]);

  for (const [productId, request] of needed) {
    const available = levels.get(productId) ?? 0;

    if (available < request.quantity) {
      throw new SaleError(SaleErrorCode.INSUFFICIENT_STOCK, {
        productName: request.description,
        available,
        requested: request.quantity,
      });
    }
  }
}

function validateSaleInputShape(input: CreateSaleDto) {
  if (input.items.length === 0) {
    throw new SaleError(SaleErrorCode.EMPTY_ITEMS);
  }

  if (input.payments.length === 0 && !input.autoPaymentMethod) {
    throw new SaleError(SaleErrorCode.EMPTY_PAYMENTS);
  }

  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new SaleError(SaleErrorCode.INVALID_ITEM_QUANTITY);
    }
  }

  for (const payment of input.payments) {
    if (!Number.isInteger(payment.amount) || payment.amount <= 0) {
      throw new SaleError(SaleErrorCode.INVALID_PAYMENT_AMOUNT);
    }
  }
}

function uniqueProductIds(items: CreateSaleDto["items"]) {
  return [...new Set(items.flatMap((item) => (item.productId ? [item.productId] : [])))];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// Los puntos se calculan con las reglas del negocio (ver loyalty.logic.ts). Si
// no están configuradas, no suma nada y la venta sigue igual: el programa de
// puntos nunca puede ser motivo para que un cobro falle.
async function pointsForThisSale(businessId: string, total: number): Promise<number> {
  const business = await prisma.business.findFirst({
    where: { id: businessId },
    select: { pointsPerAmount: true, pointValue: true },
  });

  return pointsForSale(total, {
    pointsPerAmount: business?.pointsPerAmount ?? null,
    pointValue: business?.pointValue ?? null,
  });
}
