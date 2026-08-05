import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const adminRoles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];

// Con qué nombre entra y con qué empleado vende. En un comercio chico el dueño
// es dos filas —OWNER para el panel, STAFF para el mostrador— y `sellsAsId` es
// el único lazo entre las dos (ver registerBusiness). null = no atiende él, así
// que hay que preguntar quién atiende.
export function findUserWithSellsAs(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, sellsAsId: true },
  });
}

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
      authUserId: true,
      authEmailCanonical: true,
      role: true,
      businessId: true,
    },
  });
}
