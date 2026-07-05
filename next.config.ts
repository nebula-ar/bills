import type { NextConfig } from "next";

// Orígenes permitidos para los recursos de dev de Next.js (HMR, etc.) cuando se
// accede desde otro dispositivo por IP de LAN. Se toma del entorno para no
// hardcodear la IP (que es DHCP y cambia):
//   - ALLOWED_DEV_ORIGINS: lista de hosts separada por comas (override explícito).
//   - por defecto se deriva del host de NEXTAUTH_URL (única fuente de verdad).
function resolveAllowedDevOrigins(): string[] {
  const explicit = process.env.ALLOWED_DEV_ORIGINS;

  if (explicit) {
    return explicit
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  const authUrl = process.env.NEXTAUTH_URL;

  if (authUrl) {
    try {
      return [new URL(authUrl).hostname];
    } catch {
      return [];
    }
  }

  return [];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: resolveAllowedDevOrigins(),
};

export default nextConfig;
