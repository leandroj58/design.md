"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateApiToken, hashApiToken } from "@/lib/tokens";

export async function createApiToken(name: string): Promise<{ token: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = generateApiToken();
  const { error } = await supabase.from("api_tokens").insert({
    name: name.trim() || "Sin nombre",
    token_hash: hashApiToken(token),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  return { token };
}

export async function revokeApiToken(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("api_tokens").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
