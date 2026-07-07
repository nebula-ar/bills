import { ServiceError, ServiceErrorCode } from "./service.errors";
import {
  findServiceManagementBranchById,
  findServiceManagementServiceById,
  upsertBranchServiceConfig,
} from "./service.repository";

export type UpsertBranchServiceConfigInput = {
  businessId: string;
  branchId: string;
  serviceId: string;
  price: number;
  active: boolean;
};

export async function upsertBranchServiceConfiguration(input: UpsertBranchServiceConfigInput) {
  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ServiceError(ServiceErrorCode.INVALID_PRICE);
  }

  const [branch, service] = await Promise.all([
    findServiceManagementBranchById(input.branchId, input.businessId),
    findServiceManagementServiceById(input.serviceId, input.businessId),
  ]);

  if (!branch) {
    throw new ServiceError(ServiceErrorCode.BRANCH_NOT_FOUND);
  }

  if (!service || service.businessId !== branch.businessId) {
    throw new ServiceError(ServiceErrorCode.SERVICE_NOT_FOUND);
  }

  return upsertBranchServiceConfig({
    branchId: branch.id,
    serviceId: service.id,
    price: input.price,
    active: input.active,
  });
}
