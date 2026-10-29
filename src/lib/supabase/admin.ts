import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createLocalAdminClient } from "@/lib/local-db/client";
import { requireSupabaseEnv, supabaseEnv } from "./env";

/** Cliente com service role, SOMENTE no servidor, para operações administrativas (exclusão de conta). */
export function createAdminClient() {
  if (supabaseEnv().local) return createLocalAdminClient();
  const { url } = requireSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
