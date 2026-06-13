import { ServiceError, ServiceErrorCode } from "./service.errors";
import { createGlobalService, findServiceManagementBranchById } from "./service.repository";

export type CreateGlobalServiceInput = {
  branchId: string;
  name: string;
  description?: string;
};

export async function createGlobalBusinessService(input: CreateGlobalServiceInput) {
  const name = input.name.trim();
  const description = input.description?.trim();

  if (name.length === 0) {
    throw new ServiceError(ServiceErrorCode.INVALID_SERVICE_NAME);
  }

  const branch = await findServiceManagementBranchById(input.branchId);

  if (!branch) {
    throw new ServiceError(ServiceErrorCode.BRANCH_NOT_FOUND);
  }

  return createGlobalService({
    businessId: branch.businessId,
    name,
    description: description && description.length > 0 ? description : undefined,
  });
}
