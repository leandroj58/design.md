"use client";

import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Markdown } from "tiptap-markdown";
import { useCallback, useEffect, useRef, useState } from "react";
import { archiveNote, saveNote, setLifetime } from "@/app/notes/actions";

type Note = {
  id: string;
  content_md: string;
  lifetime_days: number;
  updated_at: string;
};

type SaveState = "saved" | "saving" | "dirty" | "error";

function getMarkdown(editor: TiptapEditor): string {
  const storage = editor.storage as unknown as {
    markdown: { getMarkdown: () => string };
  };
  return storage.markdown.getMarkdown();
}

export function Editor({ note }: { note: Note }) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [copied, setCopied] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMd = useRef(note.content_md);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Typography,
      Placeholder.configure({ placeholder: "Escribí algo…" }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: note.content_md,
    onUpdate({ editor }) {
      latestMd.current = getMarkdown(editor);
      setSaveState("dirty");
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(flush, 800);
    },
  });

  const flush = useCallback(async () => {
    if (debounce.current) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
    setSaveState("saving");
    try {
      await saveNote(note.id, latestMd.current);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [note.id]);

  // Guardar lo pendiente al salir de la página.
  useEffect(() => {
    return () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
        void saveNote(note.id, latestMd.current).catch(() => {});
      }
    };
  }, [note.id]);

  async function copyMarkdown() {
    const md = editor ? getMarkdown(editor) : latestMd.current;
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-4 md:px-10">
      <header className="mb-6 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="tabular-nums">
          {saveState === "saved" && "Guardado"}
          {saveState === "dirty" && "Sin guardar…"}
          {saveState === "saving" && "Guardando…"}
          {saveState === "error" && (
            <button onClick={flush} className="text-accent underline">
              Error al guardar — reintentar
            </button>
          )}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            Vida
            <select
              defaultValue={note.lifetime_days}
              onChange={(e) => setLifetime(note.id, Number(e.target.value))}
              className="rounded-md border border-border bg-surface px-1.5 py-1 outline-none"
            >
              {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d}d
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={copyMarkdown}
            className="rounded-md border border-border bg-surface px-2.5 py-1 font-medium hover:border-accent hover:text-accent"
          >
            {copied ? "¡Copiado!" : "Copiar .md"}
          </button>
          <button
            onClick={async () => {
              await flush();
              await archiveNote(note.id);
            }}
            title="Mover al archivo"
            className="rounded-md border border-border bg-surface px-2.5 py-1 hover:border-accent hover:text-accent"
          >
            Archivar
          </button>
        </div>
      </header>

      <div className="editor flex-1" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
