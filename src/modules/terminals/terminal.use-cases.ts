import {
  createTerminal,
  findActiveTerminal,
  findBranchesForTerminals,
  findManageableBranch,
  findManageableTerminal,
  findTerminalsByBranch,
  renameTerminal,
  softDeleteTerminal,
} from "./terminal.repository";

const MAX_NAME_LENGTH = 40;

export function getBranchTerminals(branchId: string) {
  return findTerminalsByBranch(branchId);
}

export function getTerminalsManagementData() {
  return findBranchesForTerminals();
}

export function getActiveTerminal(terminalId: string) {
  return findActiveTerminal(terminalId);
}

function normalizeName(name: string) {
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

export async function createBranchTerminal(input: { branchId: string; name: string }) {
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("TERMINAL_NAME_REQUIRED");
  }

  const branch = await findManageableBranch(input.branchId);

  if (!branch) {
    throw new Error("BRANCH_NOT_FOUND");
  }

  return createTerminal({ branchId: branch.id, name });
}

export async function renameBranchTerminal(input: { terminalId: string; name: string }) {
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("TERMINAL_NAME_REQUIRED");
  }

  const terminal = await findManageableTerminal(input.terminalId);

  if (!terminal) {
    throw new Error("TERMINAL_NOT_FOUND");
  }

  return renameTerminal({ terminalId: terminal.id, name });
}

export async function deleteBranchTerminal(terminalId: string) {
  const terminal = await findManageableTerminal(terminalId);

  if (!terminal) {
    throw new Error("TERMINAL_NOT_FOUND");
  }

  return softDeleteTerminal(terminal.id);
}
