import { ProductError, ProductErrorCode } from "./product.errors";
import {
  findProductManagementBranchById,
  findProductManagementProductById,
  upsertBranchProductConfig,
} from "./product.repository";

export type UpsertBranchProductConfigInput = {
  businessId: string;
  branchId: string;
  productId: string;
  price: number;
  active: boolean;
};

export async function upsertBranchProductConfiguration(input: UpsertBranchProductConfigInput) {
  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRICE);
  }

  const [branch, product] = await Promise.all([
    findProductManagementBranchById(input.branchId, input.businessId),
    findProductManagementProductById(input.productId, input.businessId),
  ]);

  if (!branch) {
    throw new ProductError(ProductErrorCode.BRANCH_NOT_FOUND);
  }

  if (!product || product.businessId !== branch.businessId) {
    throw new ProductError(ProductErrorCode.PRODUCT_NOT_FOUND);
  }

  return upsertBranchProductConfig({
    branchId: branch.id,
    productId: product.id,
    price: input.price,
    active: input.active,
  });
}
