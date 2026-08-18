import { APP_ROLES } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";

// Quién puede entrar con contraseña. Antes eran solo OWNER y ADMIN; con los
// roles operativos (encargado, cajero, mozo, cocinero) la lista vive en
// capabilities.ts, que es la única fuente de verdad del modelo de roles.
// STAFF sigue afuera: vende por terminal con PIN, no con contraseña.

// Con qué nombre entra y con qué empleado vende. En un comercio chico el dueño
// es dos filas —OWNER para el panel, STAFF para el mostrador— y `sellsAsId` es
// el único lazo entre las dos (ver registerBusiness). null = no atiende él, así
// que hay que preguntar quién atiende.
export function findUserWithSellsAs(userId: string, businessId: string) {
  return prisma.user.findFirst({
    where: { id: userId, businessId },
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
        in: APP_ROLES,
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
