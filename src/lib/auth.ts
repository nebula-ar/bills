import "server-only";

import { UserRole } from "@/generated/prisma/client";
// La sesión la resuelve Supabase (ver el merge con master); las capacidades
// siguen siendo de Bills, porque quién puede hacer qué es una regla del negocio
// y no del proveedor de identidad.
import { can, type Capability } from "./capabilities";
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

// Roles operativos de local: comparten rango con el empleado de mostrador pero
// cada uno tiene su pantalla. Se listan aparte de STAFF a propósito: STAFF
// vende por terminal y hoy NO ve navegación, y la migración no le cambia eso.
const operationalRoles: UserRole[] = [
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.WAITER,
  UserRole.COOK,
];

/** ¿Este rol trabaja con la navegación de la app (y no con una terminal)? */
export function usesAppNav(role: UserRole | undefined) {
  return isAdminRole(role) || (role !== undefined && operationalRoles.includes(role));
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
    // `usesAppNav` y no `isAdminRole`: master cerraba la sesión a todo lo que
    // no fuera dueño o admin, pero la fusión sumó roles operativos —encargado,
    // cajero, mozo, cocina— que entran a la app con su propia pantalla. Con el
    // filtro de admin acá, el mozo no podría ni iniciar sesión.
    //
    // Esto NO afloja el control: quién puede hacer qué se sigue decidiendo
    // abajo, en `requireCapability`, con las capacidades de cada rol.
    || !usesAppNav(billsUser.role)
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

/**
 * Exige una capacidad concreta, no un rango.
 *
 * `requireAdminSession` sigue existiendo y no cambia: es el caso "solo dueño o
 * admin" y lo usan 60 pantallas. Este guard es para lo que distingue a los
 * roles operativos entre sí, donde "admin o no" ya no alcanza.
 *
 * Esconder el link en la nav NO reemplaza esto: la ruta sigue viva para quien
 * la escriba a mano. Los dos controles salen de `capabilities.ts`.
 */
export async function requireCapability(cap: Capability) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (!can(session.user.role, cap)) {
    redirect("/");
  }

  return session;
}

/**
 * Sesión de cualquier rol que trabaje con la app (no solo admin).
 *
 * Existe porque abrir el login a los roles operativos sin abrir también las
 * pantallas de entrada creó un rebote: `/` mandaba al hub a cualquiera con
 * sesión y el hub exigía admin, devolviéndolo a `/`.
 */
export async function requireAppSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (!usesAppNav(session.user.role)) {
    redirect("/terminal");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await getCurrentSession();

  if (!session?.user) redirect("/login");
  if (!isAdminRole(session.user.role)) redirect("/");

  return session;
}
