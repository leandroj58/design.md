import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTodos } from "./markdown";

/**
 * Rematerializa la tabla `todos` desde el markdown de una nota.
 * Funciona tanto con el cliente del usuario (RLS) como con el admin (MCP).
 */
export async function syncTodos(
  supabase: SupabaseClient,
  noteId: string,
  ownerId: string,
  contentMd: string
): Promise<void> {
  const todos = parseTodos(contentMd);

  const { error: delError } = await supabase
    .from("todos")
    .delete()
    .eq("note_id", noteId);
  if (delError) throw new Error(`todos delete: ${delError.message}`);

  if (todos.length === 0) return;

  const { error: insError } = await supabase.from("todos").insert(
    todos.map((t) => ({
      note_id: noteId,
      owner_id: ownerId,
      line_no: t.lineNo,
      text: t.text,
      done: t.done,
    }))
  );
  if (insError) throw new Error(`todos insert: ${insError.message}`);
}
