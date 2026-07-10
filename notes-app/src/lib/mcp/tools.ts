import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { daysLeft, extractTitle, setTodoDone } from "@/lib/markdown";
import { syncTodos } from "@/lib/todos-sync";

type ToolExtra = { authInfo?: { extra?: Record<string, unknown> } };

function userIdFrom(extra: ToolExtra): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("No autenticado");
  return userId;
}

function text(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

const NOTE_FIELDS = "id, title, status, lifetime_days, created_at, updated_at";

export function registerTools(server: McpServer) {
  const db = () => createAdminClient();

  server.tool(
    "search_notes",
    "Busca en las notas del usuario por texto (full-text, español). Devuelve id, título y metadatos.",
    {
      query: z.string().describe("Términos de búsqueda"),
      include_archived: z.boolean().optional().default(false),
    },
    async ({ query, include_archived }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      let q = db()
        .from("notes")
        .select(NOTE_FIELDS)
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(25);
      if (!include_archived) q = q.eq("status", "active");
      if (query.trim()) {
        q = q.textSearch("search_tsv", query, {
          type: "websearch",
          config: "spanish",
        });
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return text(data);
    }
  );

  server.tool(
    "get_note",
    "Devuelve el contenido markdown completo de una nota y sus metadatos.",
    { id: z.string().uuid() },
    async ({ id }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const { data, error } = await db()
        .from("notes")
        .select(`${NOTE_FIELDS}, content_md`)
        .eq("owner_id", userId)
        .eq("id", id)
        .single();
      if (error || !data) throw new Error("Nota no encontrada");
      return text(data);
    }
  );

  server.tool(
    "create_note",
    "Crea una nota nueva. El título es la primera línea del markdown.",
    { content_md: z.string().describe("Contenido en markdown") },
    async ({ content_md }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const supabase = db();
      const { data, error } = await supabase
        .from("notes")
        .insert({ owner_id: userId, content_md })
        .select("id, title")
        .single();
      if (error) throw new Error(error.message);
      await syncTodos(supabase, data.id, userId, content_md);
      return text({ id: data.id, title: extractTitle(content_md) });
    }
  );

  server.tool(
    "update_note",
    "Reemplaza el contenido markdown completo de una nota.",
    { id: z.string().uuid(), content_md: z.string() },
    async ({ id, content_md }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const supabase = db();
      const { data, error } = await supabase
        .from("notes")
        .update({ content_md })
        .eq("owner_id", userId)
        .eq("id", id)
        .select("id")
        .single();
      if (error || !data) throw new Error("Nota no encontrada");
      await syncTodos(supabase, id, userId, content_md);
      return text({ ok: true, id });
    }
  );

  server.tool(
    "append_to_note",
    "Agrega texto al final de una nota (en una línea nueva).",
    { id: z.string().uuid(), text: z.string() },
    async ({ id, text: toAppend }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const supabase = db();
      const { data: note, error } = await supabase
        .from("notes")
        .select("content_md")
        .eq("owner_id", userId)
        .eq("id", id)
        .single();
      if (error || !note) throw new Error("Nota no encontrada");
      const contentMd = note.content_md
        ? `${note.content_md.replace(/\n+$/, "")}\n\n${toAppend}`
        : toAppend;
      const { error: upError } = await supabase
        .from("notes")
        .update({ content_md: contentMd })
        .eq("owner_id", userId)
        .eq("id", id);
      if (upError) throw new Error(upError.message);
      await syncTodos(supabase, id, userId, contentMd);
      return text({ ok: true, id });
    }
  );

  server.tool(
    "archive_note",
    "Mueve una nota al archivo (no la borra).",
    { id: z.string().uuid() },
    async ({ id }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const { error } = await db()
        .from("notes")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("owner_id", userId)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return text({ ok: true, id, status: "archived" });
    }
  );

  server.tool(
    "restore_note",
    "Restaura una nota archivada y renueva su vida (Note Lifetime).",
    { id: z.string().uuid() },
    async ({ id }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const { error } = await db()
        .from("notes")
        .update({
          status: "active",
          archived_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("owner_id", userId)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return text({ ok: true, id, status: "active" });
    }
  );

  server.tool(
    "list_todos",
    "Lista los todos (checkboxes) de todas las notas del usuario.",
    {
      filter: z.enum(["open", "done", "all"]).optional().default("open"),
    },
    async ({ filter }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      let q = db()
        .from("todos")
        .select("id, note_id, text, done, line_no")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter === "open") q = q.eq("done", false);
      if (filter === "done") q = q.eq("done", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return text(data);
    }
  );

  server.tool(
    "complete_todo",
    "Marca un todo como hecho (actualiza el checkbox en el markdown de la nota).",
    { id: z.string().uuid().describe("id del todo (de list_todos)") },
    async ({ id }, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const supabase = db();
      const { data: todo, error } = await supabase
        .from("todos")
        .select("id, note_id, line_no, text")
        .eq("owner_id", userId)
        .eq("id", id)
        .single();
      if (error || !todo) throw new Error("Todo no encontrado");

      const { data: note, error: noteError } = await supabase
        .from("notes")
        .select("content_md")
        .eq("owner_id", userId)
        .eq("id", todo.note_id)
        .single();
      if (noteError || !note) throw new Error("Nota no encontrada");

      const updated = setTodoDone(note.content_md, todo.line_no, true);
      if (updated === null) {
        throw new Error(
          "La nota cambió y el todo ya no está en esa línea. Releé con get_note."
        );
      }
      const { error: upError } = await supabase
        .from("notes")
        .update({ content_md: updated })
        .eq("owner_id", userId)
        .eq("id", todo.note_id);
      if (upError) throw new Error(upError.message);
      await syncTodos(supabase, todo.note_id, userId, updated);
      return text({ ok: true, text: todo.text, done: true });
    }
  );

  server.tool(
    "get_lifetime_report",
    "Notas activas ordenadas por cuántos días les quedan antes del auto-archivado.",
    {},
    async (_args, extra) => {
      const userId = userIdFrom(extra as ToolExtra);
      const { data, error } = await db()
        .from("notes")
        .select("id, title, updated_at, lifetime_days")
        .eq("owner_id", userId)
        .eq("status", "active")
        .order("updated_at", { ascending: true })
        .limit(50);
      if (error) throw new Error(error.message);
      const report = (data ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        days_left: daysLeft(n.updated_at, n.lifetime_days),
      }));
      report.sort((a, b) => a.days_left - b.days_left);
      return text(report);
    }
  );
}
