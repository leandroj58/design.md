import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service role: SALTEA RLS. Solo para el servidor MCP, donde el
// usuario se resuelve por token API y cada query filtra por owner_id de forma
// explícita. No importar nunca desde código de cliente.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
