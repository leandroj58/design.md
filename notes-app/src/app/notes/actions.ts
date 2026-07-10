"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncTodos } from "@/lib/todos-sync";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createNote() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("notes")
    .insert({ content_md: "" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/notes", "layout");
  redirect(`/notes/${data.id}`);
}

export async function saveNote(id: string, contentMd: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notes")
    .update({ content_md: contentMd })
    .eq("id", id)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  await syncTodos(supabase, id, user.id, contentMd);
  revalidatePath("/notes", "layout");
  return { savedAt: new Date().toISOString() };
}

export async function archiveNote(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("notes")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notes", "layout");
  redirect("/notes");
}

export async function restoreNote(id: string) {
  const { supabase } = await requireUser();
  // updated_at explícito: restaurar renueva la vida de la nota.
  const { error } = await supabase
    .from("notes")
    .update({
      status: "active",
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notes", "layout");
  revalidatePath("/archive");
}

export async function deleteNoteForever(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("status", "archived");
  if (error) throw new Error(error.message);
  revalidatePath("/archive");
}

export async function setLifetime(id: string, days: number) {
  const { supabase } = await requireUser();
  const clamped = Math.max(1, Math.min(365, Math.round(days)));
  const { error } = await supabase
    .from("notes")
    .update({ lifetime_days: clamped })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/notes", "layout");
}

export type NoteListItem = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  lifetime_days: number;
};

export async function searchNotes(
  query: string,
  includeArchived = false
): Promise<NoteListItem[]> {
  const { supabase } = await requireUser();
  let q = supabase
    .from("notes")
    .select("id, title, status, updated_at, lifetime_days")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (!includeArchived) q = q.eq("status", "active");
  if (query.trim()) {
    q = q.textSearch("search_tsv", query, {
      type: "websearch",
      config: "spanish",
    });
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
