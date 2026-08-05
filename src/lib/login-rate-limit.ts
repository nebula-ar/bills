import "server-only";

import { createHmac } from "node:crypto";

import { AuthRateLimitScope, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { authRateLimitSecret } from "@/lib/supabase/config";

type Policy = { windowMs: number; maxAttempts: number; blockMs: number };

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const POLICIES: Record<AuthRateLimitScope, Policy> = {
  [AuthRateLimitScope.LOGIN_EMAIL]: { windowMs: 15 * 60_000, maxAttempts: 8, blockMs: 5 * 60_000 },
  [AuthRateLimitScope.LOGIN_IP]: { windowMs: 15 * 60_000, maxAttempts: 40, blockMs: 10 * 60_000 },
  [AuthRateLimitScope.REGISTER_IP]: {
    windowMs: 60 * 60_000,
    // Producción conserva un límite estricto. CI registra varios negocios
    // desde loopback y puede elevarlo explícitamente sin debilitar producción.
    maxAttempts: positiveIntEnv("AUTH_REGISTER_IP_MAX_ATTEMPTS", 6),
    blockMs: 60 * 60_000,
  },
  [AuthRateLimitScope.VERIFY_EMAIL]: { windowMs: 60 * 60_000, maxAttempts: 5, blockMs: 60 * 60_000 },
  [AuthRateLimitScope.VERIFY_IP]: { windowMs: 60 * 60_000, maxAttempts: 20, blockMs: 60 * 60_000 },
};

export type AuthRateLimitKey = { scope: AuthRateLimitScope; value: string };
export type RateLimitStatus = { allowed: boolean; retryAfterMs: number };

function digest(value: string): string {
  return createHmac("sha256", authRateLimitSecret()).update(value).digest("hex");
}

async function lock(tx: Prisma.TransactionClient, scope: AuthRateLimitScope, keyHash: string) {
  await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${`${scope}:${keyHash}`}))`;
}

export async function checkAuthRateLimits(keys: AuthRateLimitKey[]): Promise<RateLimitStatus> {
  const now = new Date();
  let retryAfterMs = 0;

  for (const key of keys) {
    const keyHash = digest(key.value);
    const bucket = await prisma.authRateLimitBucket.findUnique({
      where: { scope_keyHash: { scope: key.scope, keyHash } },
    });
    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      retryAfterMs = Math.max(retryAfterMs, bucket.blockedUntil.getTime() - now.getTime());
    }
  }

  return { allowed: retryAfterMs === 0, retryAfterMs };
}

export async function registerFailedAuthAttempt(keys: AuthRateLimitKey[]): Promise<void> {
  const now = new Date();

  for (const key of keys) {
    const policy = POLICIES[key.scope];
    const keyHash = digest(key.value);

    await prisma.$transaction(async (tx) => {
      await lock(tx, key.scope, keyHash);
      const current = await tx.authRateLimitBucket.findUnique({
        where: { scope_keyHash: { scope: key.scope, keyHash } },
      });
      const expired = !current || now.getTime() - current.windowStartedAt.getTime() > policy.windowMs;
      const attemptCount = expired ? 1 : current.attemptCount + 1;
      const blockedUntil = attemptCount >= policy.maxAttempts ? new Date(now.getTime() + policy.blockMs) : null;

      await tx.authRateLimitBucket.upsert({
        where: { scope_keyHash: { scope: key.scope, keyHash } },
        create: { scope: key.scope, keyHash, windowStartedAt: now, attemptCount, blockedUntil },
        update: {
          windowStartedAt: expired ? now : current.windowStartedAt,
          attemptCount,
          blockedUntil,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export async function clearAuthAttempts(key: AuthRateLimitKey): Promise<void> {
  await prisma.authRateLimitBucket.deleteMany({
    where: { scope: key.scope, keyHash: digest(key.value) },
  });
}
