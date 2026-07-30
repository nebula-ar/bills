import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findBranchesForTerminals(businessId: string) {
  return prisma.branch.findMany({
    where: {
      businessId,
      deleted: false,
      active: true,
      business: { deleted: false },
    },
    orderBy: [{ business: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      business: { select: { name: true } },
      users: {
        where: { deleted: false, active: true, role: UserRole.STAFF },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
      terminals: {
        where: { deleted: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          staffId: true,
          staff: { select: { name: true } },
        },
      },
    },
  });
}

export function findTerminalsByBranch(branchId: string) {
  return prisma.terminal.findMany({
    where: {
      branchId,
      deleted: false,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      active: true,
    },
  });
}

// Igual que findTerminalsByBranch pero para varias sucursales en UNA sola query
// (evita el fan-out N+1 en /pos). Incluye branchId para poder agrupar.
export function findTerminalsByBranchIds(branchIds: string[]) {
  return prisma.terminal.findMany({
    where: {
      branchId: { in: branchIds },
      deleted: false,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      active: true,
      branchId: true,
    },
  });
}

export function findActiveTerminal(terminalId: string) {
  return prisma.terminal.findFirst({
    where: {
      id: terminalId,
      active: true,
      deleted: false,
      branch: {
        deleted: false,
        active: true,
        business: {
          deleted: false,
        },
      },
    },
    select: {
      id: true,
      name: true,
      branchId: true,
      staffId: true,
    },
  });
}

export function findActiveBranchStaff(branchId: string, staffId: string) {
  return prisma.user.findFirst({
    where: {
      id: staffId,
      branchId,
      active: true,
      deleted: false,
      role: UserRole.STAFF,
    },
    select: { id: true },
  });
}

export function findManageableTerminal(terminalId: string, businessId: string) {
  return prisma.terminal.findFirst({
    where: {
      id: terminalId,
      deleted: false,
      branch: { businessId },
    },
    select: {
      id: true,
      branchId: true,
    },
  });
}

export function findManageableBranch(branchId: string, businessId: string) {
  return prisma.branch.findFirst({
    where: {
      id: branchId,
      businessId,
      deleted: false,
      business: {
        deleted: false,
      },
    },
    select: {
      id: true,
    },
  });
}

export function createTerminal(input: { branchId: string; name: string; staffId?: string | null }) {
  return prisma.terminal.create({
    data: {
      branchId: input.branchId,
      staffId: input.staffId ?? null,
      name: input.name,
      active: true,
    },
  });
}

export function updateTerminalDetails(input: { terminalId: string; name: string; staffId?: string | null }) {
  return prisma.terminal.update({
    where: { id: input.terminalId },
    data: { name: input.name, staffId: input.staffId ?? null },
  });
}

export function softDeleteTerminal(terminalId: string) {
  return prisma.terminal.update({
    where: { id: terminalId },
    data: {
      deleted: true,
      deletedAt: new Date(),
    },
  });
}
