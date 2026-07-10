import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiToken } from "@/lib/tokens";

/** Resuelve un bearer token (nk_...) al usuario dueño. */
export async function verifyApiToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.startsWith("nk_")) return undefined;

  const supabase = createAdminClient();
  const tokenHash = hashApiToken(bearerToken);

  const { data: row } = await supabase
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .single();

  if (!row) return undefined;

  void supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => {});

  return {
    token: bearerToken,
    clientId: row.id,
    scopes: ["notes"],
    extra: { userId: row.user_id },
  };
}
