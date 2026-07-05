// Rate limiting en memoria para el login de administradores.
// Alcanza para un despliegue de un solo proceso (SQLite + Next server). Si en el
// futuro se corre en varias instancias, migrar a un store compartido (Redis, DB).

type Attempt = {
  count: number;
  firstAt: number;
  blockedUntil: number;
};

const attempts = new Map<string, Attempt>();

const WINDOW_MS = 15 * 60 * 1000; // ventana de conteo: 15 minutos
const MAX_ATTEMPTS = 8; // intentos fallidos permitidos dentro de la ventana
const BLOCK_MS = 5 * 60 * 1000; // bloqueo tras superar el máximo: 5 minutos

export type RateLimitStatus = {
  allowed: boolean;
  retryAfterMs: number;
};

export function checkLoginRateLimit(key: string): RateLimitStatus {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry) {
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.blockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.blockedUntil - now };
  }

  if (now - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
  }

  return { allowed: true, retryAfterMs: 0 };
}

export function registerFailedLogin(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }

  entry.count += 1;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
