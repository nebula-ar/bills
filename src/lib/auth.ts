import { UserRole } from "@/generated/prisma/client";
import { can, type Capability } from "./capabilities";
import { validateAdminCredentials } from "@/modules/auth/validate-admin-credentials.use-case";
import { LoginErrorCode } from "@/lib/auth-errors";
import { checkLoginRateLimit, clearLoginAttempts, registerFailedLogin } from "@/lib/login-rate-limit";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { cache } from "react";

export const adminRoles = [UserRole.OWNER, UserRole.ADMIN] as const;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email o usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const rateLimitKey = email.trim().toLowerCase();
        const rateLimit = checkLoginRateLimit(rateLimitKey);

        if (!rateLimit.allowed) {
          // NextAuth propaga este mensaje como `error` a la UI (redirect: false).
          throw new Error(LoginErrorCode.RateLimited);
        }

        const user = await validateAdminCredentials(email, password);

        if (!user) {
          registerFailedLogin(rateLimitKey);
          return null;
        }

        clearLoginAttempts(rateLimitKey);

        return user;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.businessId = token.businessId;
      }

      return session;
    },
  },
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

// Memoizado por request (React cache): el layout y cada página piden la sesión,
// y sin esto se decodifica/verifica el JWT varias veces en el mismo request.
export const getCurrentSession = cache(async () => {
  return getServerSession(authOptions);
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

  if (!session?.user) {
    redirect("/login");
  }

  if (!isAdminRole(session.user.role)) {
    redirect("/");
  }

  return session;
}
