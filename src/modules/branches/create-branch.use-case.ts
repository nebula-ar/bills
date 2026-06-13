import { BranchError, BranchErrorCode } from "./branch.errors";
import { createBranch, findManagementBusiness } from "./branch.repository";

export type CreateBranchInput = {
  name: string;
  address?: string;
};

export async function createBranchForManagement(input: CreateBranchInput) {
  const name = input.name.trim();
  const address = normalizeOptionalString(input.address);

  if (!name) {
    throw new BranchError(BranchErrorCode.NAME_REQUIRED);
  }

  const business = await findManagementBusiness();

  if (!business) {
    throw new BranchError(BranchErrorCode.BUSINESS_NOT_FOUND);
  }

  return createBranch({
    businessId: business.id,
    name,
    address,
  });
}

function normalizeOptionalString(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}
