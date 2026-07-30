import { findProductManagementData } from "./product.repository";

export async function getBranchProductConfiguration(businessId: string, branchId?: string) {
  return findProductManagementData(businessId, branchId);
}
