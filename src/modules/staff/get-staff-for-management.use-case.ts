import { findActiveStaffsForManagement, findBranchesForStaffManagement } from "./staff.repository";

export async function getStaffsForManagement(businessId: string) {
  const [staffs, branches] = await Promise.all([
    findActiveStaffsForManagement(businessId),
    findBranchesForStaffManagement(businessId),
  ]);

  return { staffs, branches };
}
