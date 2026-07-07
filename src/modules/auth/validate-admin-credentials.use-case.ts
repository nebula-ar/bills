import { compare } from "bcryptjs";

import { findActiveAdminUserByEmail } from "./user.repository";

// Hash bcrypt válido pero inalcanzable. Se compara contra él cuando el usuario no
// existe para que el tiempo de respuesta sea el mismo que con un usuario real, y así
// no filtrar por timing qué emails están registrados (user enumeration).
const TIMING_SAFE_DUMMY_HASH = "$2b$12$cMpW9/5uxTAnNRpuRaY5uuf62M2YmSIXVcYk2ARuPucGIrwPXMOme";

export async function validateAdminCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return null;
  }

  const user = await findActiveAdminUserByEmail(normalizedEmail);

  if (!user?.email || !user.passwordHash) {
    // Igualamos el costo de cómputo para no revelar si el email existe.
    await compare(password, TIMING_SAFE_DUMMY_HASH);
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
    businessId: user.businessId,
  };
}
