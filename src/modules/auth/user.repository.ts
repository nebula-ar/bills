import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const adminRoles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];

export function findActiveAdminUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email,
      active: true,
      deleted: false,
      role: {
        in: adminRoles,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      businessId: true,
    },
  });
}
