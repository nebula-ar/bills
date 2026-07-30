import { ProductError, ProductErrorCode } from "./product.errors";
import { findBranchProductPriceForUpdate, updateBranchProductPrice } from "./product.repository";

export type UpdateBranchProductInput = {
  branchId: string;
  productPriceId: string;
  price: number;
  active: boolean;
};

export async function updateBranchProduct(input: UpdateBranchProductInput) {
  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRICE);
  }

  const productPrice = await findBranchProductPriceForUpdate(input.branchId, input.productPriceId);

  if (!productPrice) {
    throw new ProductError(ProductErrorCode.PRODUCT_PRICE_NOT_FOUND);
  }

  return updateBranchProductPrice({
    productPriceId: productPrice.id,
    price: input.price,
    active: input.active,
  });
}
