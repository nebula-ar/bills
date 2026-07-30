import {
  createTerminal,
  findActiveBranchStaff,
  findActiveTerminal,
  findBranchesForTerminals,
  findManageableBranch,
  findManageableTerminal,
  findTerminalsByBranch,
  findTerminalsByBranchIds,
  softDeleteTerminal,
  updateTerminalDetails,
} from "./terminal.repository";

const MAX_NAME_LENGTH = 40;

export function getBranchTerminals(branchId: string) {
  return findTerminalsByBranch(branchId);
}

// Terminales de varias sucursales agrupadas por branchId, en una sola query.
export async function getTerminalsByBranchIds(branchIds: string[]) {
  const grouped = new Map<string, { id: string; name: string; active: boolean }[]>();
  if (branchIds.length === 0) return grouped;

  const terminals = await findTerminalsByBranchIds(branchIds);
  for (const terminal of terminals) {
    const list = grouped.get(terminal.branchId) ?? [];
    list.push({ id: terminal.id, name: terminal.name, active: terminal.active });
    grouped.set(terminal.branchId, list);
  }
  return grouped;
}

export function getTerminalsManagementData(businessId: string) {
  return findBranchesForTerminals(businessId);
}

export function getActiveTerminal(terminalId: string) {
  return findActiveTerminal(terminalId);
}

function normalizeName(name: string) {
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

async function resolveStaffId(branchId: string, staffId?: string | null) {
  if (!staffId) {
    return null;
  }
  const staff = await findActiveBranchStaff(branchId, staffId);
  if (!staff) {
    throw new Error("STAFF_NOT_IN_BRANCH");
  }
  return staff.id;
}

export async function createBranchTerminal(input: {
  businessId: string;
  branchId: string;
  name: string;
  staffId?: string | null;
}) {
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("TERMINAL_NAME_REQUIRED");
  }

  const branch = await findManageableBranch(input.branchId, input.businessId);

  if (!branch) {
    throw new Error("BRANCH_NOT_FOUND");
  }

  const staffId = await resolveStaffId(branch.id, input.staffId);

  return createTerminal({ branchId: branch.id, name, staffId });
}

export async function updateBranchTerminal(input: {
  businessId: string;
  terminalId: string;
  name: string;
  staffId?: string | null;
}) {
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("TERMINAL_NAME_REQUIRED");
  }

  const terminal = await findManageableTerminal(input.terminalId, input.businessId);

  if (!terminal) {
    throw new Error("TERMINAL_NOT_FOUND");
  }

  const staffId = await resolveStaffId(terminal.branchId, input.staffId);

  return updateTerminalDetails({ terminalId: terminal.id, name, staffId });
}

export async function deleteBranchTerminal(input: { businessId: string; terminalId: string }) {
  const terminal = await findManageableTerminal(input.terminalId, input.businessId);

  if (!terminal) {
    throw new Error("TERMINAL_NOT_FOUND");
  }

  return softDeleteTerminal(terminal.id);
}
