import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { User as SupabaseUser } from "@supabase/supabase-js";

import {
  AuthProvisionKind,
  AuthProvisionStatus,
  EmailOwnershipStatus,
  Prisma,
  UserRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { expectedEnvironmentInstanceId } from "@/lib/supabase/config";

const LEASE_MS = 60_000;
const MAX_RETRIES = 5;

export class AuthProvisionError extends Error {
  constructor(public readonly code: "BUSY" | "CONFLICT" | "RETRYABLE" | "EXHAUSTED" | "INVALID_USER") {
    super(code);
    this.name = "AuthProvisionError";
  }
}

type Claim = {
  attemptId: string;
  nonce: string;
  environmentInstanceId: string;
  user: { id: string; businessId: string; email: string };
};

async function claimProvision(userId: string, kind: AuthProvisionKind): Promise<Claim | { authUserId: string }> {
  const environmentInstanceId = expectedEnvironmentInstanceId();
  const attemptId = randomUUID();
  const nonce = randomBytes(32).toString("base64url");
  const leaseOwner = `${process.pid}:${randomUUID()}`;
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${`auth-provision:${userId}`}))`;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        businessId: true,
        email: true,
        authEmailCanonical: true,
        authUserId: true,
        active: true,
        deleted: true,
        role: true,
      },
    });

    if (!user || !user.active || user.deleted || user.role === UserRole.STAFF || !user.email) {
      throw new AuthProvisionError("INVALID_USER");
    }
    if (user.authUserId) return { authUserId: user.authUserId };
    const emailCanonical = user.email.trim().toLowerCase();
    const job = await tx.authProvisionJob.findUnique({ where: { userId } });
    if (!job || job.kind !== kind || job.emailCanonical !== emailCanonical) {
      throw new AuthProvisionError("INVALID_USER");
    }

    if (job.status === AuthProvisionStatus.CONFLICT) throw new AuthProvisionError("CONFLICT");
    if (job.status === AuthProvisionStatus.EXHAUSTED) throw new AuthProvisionError("EXHAUSTED");
    if (job.status === AuthProvisionStatus.CANCELLED) throw new AuthProvisionError("EXHAUSTED");
    if (job.status === AuthProvisionStatus.CLAIMED && job.leaseUntil && job.leaseUntil > now) {
      throw new AuthProvisionError("BUSY");
    }
    if (job.nextRetryAt && job.nextRetryAt > now) throw new AuthProvisionError("BUSY");

    await tx.authProvisionAttempt.create({
      data: {
        id: attemptId,
        jobId: job.id,
        kind: job.kind,
        status: AuthProvisionStatus.CLAIMED,
        nonce,
        environmentInstanceId,
      },
    });
    await tx.authProvisionJob.update({
      where: { id: job.id },
      data: {
        status: AuthProvisionStatus.CLAIMED,
        currentAttemptId: attemptId,
        claimedAt: now,
        leaseUntil,
        leaseOwner,
        lastErrorCode: null,
      },
    });

    return {
      attemptId,
      nonce,
      environmentInstanceId,
      user: { id: user.id, businessId: user.businessId, email: emailCanonical },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function hasTrustedMetadata(authUser: SupabaseUser, claim: Claim): boolean {
  const metadata = authUser.app_metadata ?? {};
  return (
    metadata.environment_instance_id === claim.environmentInstanceId
    && metadata.bills_user_id === claim.user.id
    && metadata.bills_business_id === claim.user.businessId
  );
}

async function findTrustedExistingUser(claim: Claim): Promise<SupabaseUser | null> {
  const admin = await createSupabaseAdminClient();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === claim.user.email);
    if (match) return hasTrustedMetadata(match, claim) ? match : null;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function finishProvision(claim: Claim, authUser: SupabaseUser): Promise<string> {
  if (!hasTrustedMetadata(authUser, claim)) throw new AuthProvisionError("CONFLICT");
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${`auth-provision:${claim.user.id}`}))`;
    const job = await tx.authProvisionJob.findUnique({ where: { userId: claim.user.id } });
    const user = await tx.user.findUnique({ where: { id: claim.user.id }, select: { authUserId: true } });

    if (user?.authUserId === authUser.id) return;
    if (!job || job.currentAttemptId !== claim.attemptId || user?.authUserId) {
      throw new AuthProvisionError("CONFLICT");
    }

    await tx.authProvisionAttempt.update({
      where: { id: claim.attemptId },
      data: { status: AuthProvisionStatus.LINKED, authUserId: authUser.id, finishedAt: now },
    });
    await tx.user.update({
      where: { id: claim.user.id },
      data: {
        authUserId: authUser.id,
        authEmailCanonical: claim.user.email,
        authLinkedAt: now,
        emailOwnershipStatus: EmailOwnershipStatus.UNVERIFIED_AUTOCONFIRM,
      },
    });
    await tx.authProvisionJob.update({
      where: { id: job.id },
      data: {
        status: AuthProvisionStatus.LINKED,
        leaseUntil: null,
        leaseOwner: null,
        nextRetryAt: null,
        lastErrorCode: null,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return authUser.id;
}

async function failProvision(claim: Claim, code: string, conflict: boolean): Promise<never> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const job = await tx.authProvisionJob.findUnique({ where: { userId: claim.user.id } });
    if (!job || job.currentAttemptId !== claim.attemptId) return;
    const retryCount = job.retryCount + 1;
    const status = conflict
      ? AuthProvisionStatus.CONFLICT
      : retryCount >= MAX_RETRIES
        ? AuthProvisionStatus.EXHAUSTED
        : AuthProvisionStatus.RETRYABLE;

    await tx.authProvisionAttempt.update({
      where: { id: claim.attemptId },
      data: { status, errorCode: code, finishedAt: now },
    });
    await tx.authProvisionJob.update({
      where: { id: job.id },
      data: {
        status,
        retryCount,
        nextRetryAt: status === AuthProvisionStatus.RETRYABLE ? new Date(now.getTime() + 30_000 * retryCount) : null,
        leaseUntil: null,
        leaseOwner: null,
        lastErrorCode: code,
      },
    });
  });

  throw new AuthProvisionError(conflict ? "CONFLICT" : "RETRYABLE");
}

export async function provisionAuthIdentity(input: {
  userId: string;
  password: string;
  kind: AuthProvisionKind;
}): Promise<string> {
  const claimed = await claimProvision(input.userId, input.kind);
  if ("authUserId" in claimed) return claimed.authUserId;
  const admin = await createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: claimed.user.email,
    password: input.password,
    email_confirm: true,
    app_metadata: {
      environment_instance_id: claimed.environmentInstanceId,
      bills_user_id: claimed.user.id,
      bills_business_id: claimed.user.businessId,
      provision_attempt_id: claimed.attemptId,
      provision_nonce: claimed.nonce,
    },
  });

  if (!error && data.user) return finishProvision(claimed, data.user);

  try {
    // Si GoTrue creó el usuario pero la respuesta se perdió, lo recuperamos
    // exclusivamente por metadata confiable. Coincidir sólo por email nunca basta.
    const trusted = await findTrustedExistingUser(claimed);
    if (trusted) return finishProvision(claimed, trusted);
  } catch {
    // Conservamos abajo el error original de creación y dejamos el job reintentable.
  }

  const errorCode = error?.code || `HTTP_${error?.status ?? "UNKNOWN"}`;
  const duplicate = error?.status === 422 || /exist|registered|duplicate/i.test(error?.message ?? "");
  return failProvision(claimed, errorCode, duplicate);
}
