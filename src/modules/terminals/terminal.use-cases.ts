import {
  createTerminal,
  findActiveBranchBarber,
  findActiveTerminal,
  findBranchesForTerminals,
  findManageableBranch,
  findManageableTerminal,
  findTerminalsByBranch,
  softDeleteTerminal,
  updateTerminalDetails,
} from "./terminal.repository";

const MAX_NAME_LENGTH = 40;

export function getBranchTerminals(branchId: string) {
  return findTerminalsByBranch(branchId);
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

async function resolveBarberId(branchId: string, barberId?: string | null) {
  if (!barberId) {
    return null;
  }
  const barber = await findActiveBranchBarber(branchId, barberId);
  if (!barber) {
    throw new Error("BARBER_NOT_IN_BRANCH");
  }
  return barber.id;
}

export async function createBranchTerminal(input: {
  businessId: string;
  branchId: string;
  name: string;
  barberId?: string | null;
}) {
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("TERMINAL_NAME_REQUIRED");
  }

  const branch = await findManageableBranch(input.branchId, input.businessId);

  if (!branch) {
    throw new Error("BRANCH_NOT_FOUND");
  }

  const barberId = await resolveBarberId(branch.id, input.barberId);

  return createTerminal({ branchId: branch.id, name, barberId });
}

export async function updateBranchTerminal(input: {
  businessId: string;
  terminalId: string;
  name: string;
  barberId?: string | null;
}) {
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("TERMINAL_NAME_REQUIRED");
  }

  const terminal = await findManageableTerminal(input.terminalId, input.businessId);

  if (!terminal) {
    throw new Error("TERMINAL_NOT_FOUND");
  }

  const barberId = await resolveBarberId(terminal.branchId, input.barberId);

  return updateTerminalDetails({ terminalId: terminal.id, name, barberId });
}

export async function deleteBranchTerminal(input: { businessId: string; terminalId: string }) {
  const terminal = await findManageableTerminal(input.terminalId, input.businessId);

  if (!terminal) {
    throw new Error("TERMINAL_NOT_FOUND");
  }

  return softDeleteTerminal(terminal.id);
}
