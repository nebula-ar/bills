import { ProductError, ProductErrorCode } from "./product.errors";
import { createGlobalProduct, findProductManagementBranchById } from "./product.repository";

export type CreateGlobalProductInput = {
  businessId: string;
  branchId: string;
  name: string;
  description?: string;
};

export async function createGlobalBusinessProduct(input: CreateGlobalProductInput) {
  const name = input.name.trim();
  const description = input.description?.trim();

  if (name.length === 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRODUCT_NAME);
  }

  const branch = await findProductManagementBranchById(input.branchId, input.businessId);

  if (!branch) {
    throw new ProductError(ProductErrorCode.BRANCH_NOT_FOUND);
  }

  return createGlobalProduct({
    businessId: branch.businessId,
    name,
    description: description && description.length > 0 ? description : undefined,
  });
}
