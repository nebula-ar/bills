import { findServiceManagementData } from "./service.repository";

export async function getBranchServiceConfiguration(businessId: string, branchId?: string) {
  return findServiceManagementData(businessId, branchId);
}
