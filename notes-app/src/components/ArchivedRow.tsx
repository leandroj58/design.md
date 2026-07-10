"use client";

import { useState } from "react";
import { deleteNoteForever, restoreNote } from "@/app/notes/actions";
import { extractTitle } from "@/lib/markdown";

type ArchivedNote = {
  id: string;
  content_md: string;
  archived_at: string | null;
};

export function ArchivedRow({ note }: { note: ArchivedNote }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {extractTitle(note.content_md)}
        </p>
        <p className="text-xs text-muted">
          Archivada el{" "}
          {note.archived_at
            ? new Date(note.archived_at).toLocaleDateString("es")
            : "—"}
        </p>
      </div>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(note.content_md);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
      >
        {copied ? "¡Copiado!" : "Copiar .md"}
      </button>
      <button
        onClick={() => restoreNote(note.id)}
        className="rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
      >
        Restaurar
      </button>
      {confirming ? (
        <button
          onClick={() => deleteNoteForever(note.id)}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white"
        >
          ¿Seguro?
        </button>
      ) : (
        <button
          onClick={() => {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 3000);
          }}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
        >
          Borrar
        </button>
      )}
    </li>
  );
}
