import { findActiveBarbersForManagement, findBranchesForBarberManagement } from "./barber.repository";

export async function getBarbersForManagement() {
  const [barbers, branches] = await Promise.all([findActiveBarbersForManagement(), findBranchesForBarberManagement()]);

  return { barbers, branches };
}
