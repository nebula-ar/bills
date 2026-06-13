import { ServiceError, ServiceErrorCode } from "./service.errors";
import { findBranchServicePriceForUpdate, updateBranchServicePrice } from "./service.repository";

export type UpdateBranchServiceInput = {
  branchId: string;
  servicePriceId: string;
  price: number;
  active: boolean;
};

export async function updateBranchService(input: UpdateBranchServiceInput) {
  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new ServiceError(ServiceErrorCode.INVALID_PRICE);
  }

  const servicePrice = await findBranchServicePriceForUpdate(input.branchId, input.servicePriceId);

  if (!servicePrice) {
    throw new ServiceError(ServiceErrorCode.SERVICE_PRICE_NOT_FOUND);
  }

  return updateBranchServicePrice({
    servicePriceId: servicePrice.id,
    price: input.price,
    active: input.active,
  });
}
