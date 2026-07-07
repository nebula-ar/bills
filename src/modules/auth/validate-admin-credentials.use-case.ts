import { compare } from "bcryptjs";

import { findActiveAdminUserByIdentifier } from "./user.repository";

// Hash bcrypt válido pero inalcanzable. Se compara contra él cuando el usuario no
// existe para que el tiempo de respuesta sea el mismo que con un usuario real, y así
// no filtrar por timing qué emails están registrados (user enumeration).
const TIMING_SAFE_DUMMY_HASH = "$2b$12$cMpW9/5uxTAnNRpuRaY5uuf62M2YmSIXVcYk2ARuPucGIrwPXMOme";

export async function validateAdminCredentials(identifier: string, password: string) {
  // Acepta email o nombre de usuario (ambos se guardan en minúsculas).
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (!normalizedIdentifier || !password) {
    return null;
  }

  const user = await findActiveAdminUserByIdentifier(normalizedIdentifier);

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
