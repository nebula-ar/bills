import { ServiceError, ServiceErrorCode } from "./service.errors";
import { createBranchServiceTransaction, findServiceManagementBranchById } from "./service.repository";

export type CreateBranchServiceInput = {
  businessId: string;
  branchId: string;
  name: string;
  description?: string;
  price: number;
};

export async function createBranchService(input: CreateBranchServiceInput) {
  const name = input.name.trim();
  const description = input.description?.trim();

  if (name.length === 0) {
    throw new ServiceError(ServiceErrorCode.INVALID_SERVICE_NAME);
  }

  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ServiceError(ServiceErrorCode.INVALID_PRICE);
  }

  const branch = await findServiceManagementBranchById(input.branchId, input.businessId);

  if (!branch) {
    throw new ServiceError(ServiceErrorCode.BRANCH_NOT_FOUND);
  }

  return createBranchServiceTransaction({
    branchId: branch.id,
    businessId: branch.businessId,
    name,
    description: description && description.length > 0 ? description : undefined,
    price: input.price,
  });
}
