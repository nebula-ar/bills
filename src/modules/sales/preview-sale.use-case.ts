import { applyPromotions, type CartLine } from "@/modules/promotions/promotion.logic";
import { findActivePromotions } from "@/modules/promotions/promotion.repository";

import { findBranchProductPrices } from "./sale.repository";

export type PreviewSaleInput = {
  businessId: string;
  branchId: string;
  items: { productId: string; quantity: number }[];
};

export type PreviewSaleOutput = {
  subtotal: number;
  discountTotal: number;
  total: number;
  discounts: { description: string; amount: number }[];
};

// Corre el mismo motor de promociones que `createSale` pero sin escribir nada.
// Existe para que el POS muestre el total definitivo mientras se arma el pedido:
// si el vendedor viera el precio de lista y después se cobrara otro, el sistema
// perdería la confianza de quien lo usa.
export async function previewSaleTotals(input: PreviewSaleInput): Promise<PreviewSaleOutput> {
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const prices = await findBranchProductPrices(input.branchId, productIds);
  const priceByProductId = new Map(prices.map((price) => [price.productId, price]));

  const lines: CartLine[] = input.items.flatMap((item) => {
    const price = priceByProductId.get(item.productId);

    // Un ítem sin precio en la sucursal no se puede previsualizar; la venta real
    // lo va a rechazar con un error claro.
    if (!price) return [];

    return [
      {
        productId: item.productId,
        categoryId: price.product.categoryId,
        description: price.product.name,
        quantity: item.quantity,
        unitPrice: price.price,
      },
    ];
  });

  const promotions = await findActivePromotions(input.businessId, input.branchId);
  const result = applyPromotions(lines, promotions, new Date());

  return {
    subtotal: result.subtotal,
    discountTotal: result.discountTotal,
    total: result.total,
    discounts: result.discounts.map((discount) => ({ description: discount.description, amount: discount.amount })),
  };
}
