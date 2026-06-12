import { compare } from "bcryptjs";

import { findActiveAdminUserByEmail } from "./user.repository";

export async function validateAdminCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return null;
  }

  const user = await findActiveAdminUserByEmail(normalizedEmail);

  if (!user?.email || !user.passwordHash) {
    return null;
  }

  const passwordMatches = await compare(password, user.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
