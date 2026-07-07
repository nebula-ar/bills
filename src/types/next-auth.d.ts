import type { UserRole } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      businessId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    businessId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    businessId: string;
  }
}
