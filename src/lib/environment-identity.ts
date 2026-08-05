import "server-only";

import { prisma } from "@/lib/prisma";

import { expectedEnvironmentInstanceId } from "./supabase/config";

type EnvironmentIdentityRow = {
  instance_id: string;
  environment: string;
};

// Esta tabla vive en `ops`, la posee un rol NOLOGIN separado y la app sólo
// puede leerla. Evita que un release o una credencial apunten a otra instancia.
export async function assertEnvironmentIdentity(): Promise<EnvironmentIdentityRow> {
  const rows = await prisma.$queryRaw<EnvironmentIdentityRow[]>`
    SELECT instance_id::text, environment
    FROM ops.environment_identity
    WHERE singleton = true
  `;
  const actual = rows[0];
  const expected = expectedEnvironmentInstanceId();

  if (!actual || actual.instance_id !== expected) {
    throw new Error("ENVIRONMENT_IDENTITY_MISMATCH");
  }

  return actual;
}
