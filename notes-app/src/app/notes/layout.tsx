import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";

export default async function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("notes")
    .select("id, title, status, updated_at, lifetime_days")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar initialNotes={notes ?? []} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
