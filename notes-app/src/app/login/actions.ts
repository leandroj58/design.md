"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isEmailAllowed(email: string): boolean {
  const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  if (allowedEmails.length === 0 && allowedDomains.length === 0) return true;
  if (allowedEmails.includes(email)) return true;
  const domain = email.split("@")[1] ?? "";
  return allowedDomains.includes(domain);
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) redirect("/login?error=invalid");
  // No revelamos si el email está o no en la lista: mismo mensaje que el envío OK.
  if (!isEmailAllowed(email)) redirect("/login?sent=1");

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${site}/auth/confirm` },
  });

  if (error) redirect("/login?error=send");
  redirect("/login?sent=1");
}
