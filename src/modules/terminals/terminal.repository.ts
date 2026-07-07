import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findBranchesForTerminals() {
  return prisma.branch.findMany({
    where: {
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
        where: { deleted: false, active: true, role: UserRole.BARBER },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
      terminals: {
        where: { deleted: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
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
    },
  });
}

export function findManageableTerminal(terminalId: string) {
  return prisma.terminal.findFirst({
    where: {
      id: terminalId,
      deleted: false,
    },
    select: {
      id: true,
      branchId: true,
    },
  });
}

export function findManageableBranch(branchId: string) {
  return prisma.branch.findFirst({
    where: {
      id: branchId,
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

export function createTerminal(input: { branchId: string; name: string }) {
  return prisma.terminal.create({
    data: {
      branchId: input.branchId,
      name: input.name,
      active: true,
    },
  });
}

export function renameTerminal(input: { terminalId: string; name: string }) {
  return prisma.terminal.update({
    where: { id: input.terminalId },
    data: { name: input.name },
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
