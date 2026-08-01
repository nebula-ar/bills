import { lineTotal } from "@/lib/quantity";
import { findOperatingPurchasesInRange } from "@/modules/suppliers/supplier.repository";

import { findInventoryLossesInRange, findReturnedItemsInRange, findStockForValuation } from "./report.repository";

export { computeProfit, operatingExpensesOf } from "./profit.logic";
export type { Profit, ProfitInput } from "./profit.logic";

// Lo devuelto en el período: la plata que se le devolvió al cliente y el costo
// de la mercadería que volvió a la góndola. Las dos cosas se netean, cada una
// contra su lado de la cuenta.
export async function getReturnsInRange(input: { businessId: string; from?: Date; to?: Date }) {
  const items = await findReturnedItemsInRange(input.businessId, input.from, input.to);

  let returnedRevenue = 0;
  let returnedCost = 0;

  for (const item of items) {
    returnedRevenue += item.amount;
    if (item.saleItem.unitCost) {
      returnedCost += lineTotal(item.saleItem.unitCost, item.quantity);
    }
  }

  return { returnedRevenue, returnedCost };
}

// Mercadería perdida en el período, valuada al costo con el que salió. Se
// devuelve también el detalle: "perdiste $45.000" no sirve de nada si no decís
// en qué.
export async function getInventoryLossesInRange(input: { businessId: string; from?: Date; to?: Date }) {
  const movements = await findInventoryLossesInRange(input.businessId, input.from, input.to);

  let total = 0;
  const byProduct = new Map<string, number>();

  for (const movement of movements) {
    if (!movement.unitCost) continue;

    // La cantidad viene negativa (salió): el costo se cuenta en positivo.
    const cost = lineTotal(movement.unitCost, Math.abs(movement.quantity));
    total += cost;
    byProduct.set(movement.product.name, (byProduct.get(movement.product.name) ?? 0) + cost);
  }

  return {
    total,
    byProduct: Array.from(byProduct.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

// Facturas de proveedor que no son mercadería: el service del freezer, un
// flete, el contador. Son gasto operativo y bajan la ganancia del período en
// que se emitió la factura (devengado), no cuando se pagan.
//
// El IVA discriminado no es gasto: para un Responsable Inscripto es crédito
// fiscal, o sea que se recupera. Se descuenta del total.
export async function getOperatingPurchasesInRange(input: { businessId: string; from?: Date; to?: Date }) {
  const purchases = await findOperatingPurchasesInRange(input.businessId, input.from, input.to);

  return purchases.reduce((total, purchase) => {
    const credited = purchase.credits.reduce((sum, credit) => sum + credit.amount, 0);
    return total + Math.max(purchase.total - (purchase.taxAmount ?? 0) - credited, 0);
  }, 0);
}

// Cuánta plata hay parada en mercadería. Es la otra mitad de la foto: lo que
// una compra sacó de la caja no se evaporó, está acá.
export async function getStockValuation(businessId: string) {
  const products = await findStockForValuation(businessId);

  let value = 0;
  let productsWithoutCost = 0;

  for (const product of products) {
    let counted = false;
    let missing = false;

    // Sucursal por sucursal: cada una tiene su propio promedio, porque cada una
    // le compró a su precio.
    for (const level of product.stockLevels) {
      const quantity = Math.max(level.quantity, 0);
      if (quantity === 0) continue;

      const cost = level.avgCost ?? product.cost;
      if (cost) {
        value += lineTotal(cost, quantity);
        counted = true;
      } else {
        missing = true;
      }
    }

    if (missing && !counted) productsWithoutCost += 1;
  }

  return { value, productsWithoutCost };
}
