import { findServiceManagementData } from "./service.repository";

export async function getBranchServiceConfiguration(branchId?: string) {
  return findServiceManagementData(branchId);
}
