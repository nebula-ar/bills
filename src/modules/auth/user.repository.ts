import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const adminRoles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];

export function findActiveAdminUserByIdentifier(identifier: string) {
  return prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
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
