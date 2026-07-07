import { UserRole } from "@/generated/prisma/client";
import { validateAdminCredentials } from "@/modules/auth/validate-admin-credentials.use-case";
import { LoginErrorCode } from "@/lib/auth-errors";
import { checkLoginRateLimit, clearLoginAttempts, registerFailedLogin } from "@/lib/login-rate-limit";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";

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

export async function getCurrentSession() {
  return getServerSession(authOptions);
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
