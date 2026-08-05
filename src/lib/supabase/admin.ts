import "server-only";

import { createClient } from "@supabase/supabase-js";

import { assertEnvironmentIdentity } from "@/lib/environment-identity";

import { supabaseServerUrl, supabaseServiceRoleKey } from "./config";

export async function createSupabaseAdminClient() {
  await assertEnvironmentIdentity();

  return createClient(supabaseServerUrl(), supabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
