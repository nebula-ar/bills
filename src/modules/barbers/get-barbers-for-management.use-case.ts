import { findActiveBarbersForManagement, findBranchesForBarberManagement } from "./barber.repository";

export async function getBarbersForManagement(businessId: string) {
  const [barbers, branches] = await Promise.all([
    findActiveBarbersForManagement(businessId),
    findBranchesForBarberManagement(businessId),
  ]);

  return { barbers, branches };
}
