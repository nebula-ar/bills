import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findActiveBarberForPinValidation(barberId: string, branchId?: string) {
  return prisma.user.findFirst({
    where: {
      id: barberId,
      branchId,
      active: true,
      deleted: false,
      role: UserRole.BARBER,
      branch: branchId
        ? {
            id: branchId,
            deleted: false,
          }
        : undefined,
      business: {
        deleted: false,
      },
    },
    select: {
      id: true,
      pinHash: true,
    },
  });
}

export function findActiveBarbersForManagement() {
  return prisma.user.findMany({
    where: {
      active: true,
      deleted: false,
      role: UserRole.BARBER,
      business: {
        deleted: false,
      },
      branch: {
        deleted: false,
      },
    },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      pinHash: true,
      branch: {
        select: {
          name: true,
          business: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
}

export function updateBarberPinHash(barberId: string, pinHash: string) {
  return prisma.user.updateMany({
    where: {
      id: barberId,
      active: true,
      deleted: false,
      role: UserRole.BARBER,
    },
    data: {
      pinHash,
    },
  });
}
