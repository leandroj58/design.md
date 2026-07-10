import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Editor } from "@/components/Editor";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: note } = await supabase
    .from("notes")
    .select("id, content_md, lifetime_days, updated_at, status")
    .eq("id", id)
    .single();

  if (!note || note.status !== "active") notFound();

  return <Editor key={note.id} note={note} />;
}
