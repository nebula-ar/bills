import { findActiveBarbersForManagement } from "./barber.repository";

export async function getBarbersForManagement() {
  return findActiveBarbersForManagement();
}
