import { ProductError, ProductErrorCode } from "./product.errors";
import { createBranchProductTransaction, findProductManagementBranchById } from "./product.repository";

export type CreateBranchProductInput = {
  businessId: string;
  branchId: string;
  name: string;
  description?: string;
  price: number;
};

export async function createBranchProduct(input: CreateBranchProductInput) {
  const name = input.name.trim();
  const description = input.description?.trim();

  if (name.length === 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRODUCT_NAME);
  }

  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ProductError(ProductErrorCode.INVALID_PRICE);
  }

  const branch = await findProductManagementBranchById(input.branchId, input.businessId);

  if (!branch) {
    throw new ProductError(ProductErrorCode.BRANCH_NOT_FOUND);
  }

  return createBranchProductTransaction({
    branchId: branch.id,
    businessId: branch.businessId,
    name,
    description: description && description.length > 0 ? description : undefined,
    price: input.price,
  });
}
