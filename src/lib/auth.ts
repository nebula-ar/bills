import "server-only";

import { UserRole } from "@/generated/prisma/client";
import { assertEnvironmentIdentity } from "@/lib/environment-identity";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export const adminRoles = [UserRole.OWNER, UserRole.ADMIN] as const;

export type CurrentSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    businessId: string;
  };
};

export function isAdminRole(role: UserRole | undefined) {
  return role === UserRole.OWNER || role === UserRole.ADMIN;
}

// Supabase valida/rota el JWT; la autorización de Bills sale siempre de su DB.
// La metadata sólo se acepta si fue escrita por nuestro cliente service-role y
// coincide simultáneamente con instancia, UUID de usuario y negocio.
export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const environment = await assertEnvironmentIdentity();
  const billsUser = await prisma.user.findUnique({
    where: { authUserId: data.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      businessId: true,
      active: true,
      deleted: true,
    },
  });
  const metadata = data.user.app_metadata ?? {};

  if (
    !billsUser
    || !billsUser.email
    || !billsUser.active
    || billsUser.deleted
    || !isAdminRole(billsUser.role)
    || metadata.environment_instance_id !== environment.instance_id
    || metadata.bills_user_id !== billsUser.id
    || metadata.bills_business_id !== billsUser.businessId
  ) {
    return null;
  }

  return {
    user: {
      id: billsUser.id,
      name: billsUser.name,
      email: billsUser.email,
      role: billsUser.role,
      businessId: billsUser.businessId,
    },
  };
});

export async function requireAdminSession() {
  const session = await getCurrentSession();

  if (!session?.user) redirect("/login");
  if (!isAdminRole(session.user.role)) redirect("/");

  return session;
}
