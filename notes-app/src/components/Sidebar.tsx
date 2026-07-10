"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createNote, searchNotes, type NoteListItem } from "@/app/notes/actions";
import { LifetimeBadge } from "./LifetimeBadge";

export function Sidebar({ initialNotes }: { initialNotes: NoteListItem[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sin búsqueda activa, la lista sigue al server (nuevas notas, títulos, orden).
  useEffect(() => {
    if (!query.trim()) setNotes(initialNotes);
  }, [initialNotes, query]);

  function onSearch(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        setNotes(await searchNotes(value));
      });
    }, 250);
  }

  return (
    <aside className="flex h-dvh w-72 shrink-0 flex-col border-r border-border bg-surface max-md:hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link href="/notes" className="text-sm font-bold tracking-tight">
          Notas
        </Link>
        <form action={createNote}>
          <button
            type="submit"
            title="Nueva nota"
            className="rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-white hover:opacity-90"
          >
            +
          </button>
        </form>
      </div>

      <div className="px-4 pt-3">
        <input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar…"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-2">
        {notes.length === 0 && (
          <p className="px-2 pt-4 text-sm text-muted">
            {query ? "Sin resultados." : "Todavía no hay notas."}
          </p>
        )}
        <ul className="flex flex-col gap-0.5">
          {notes.map((n) => {
            const active = pathname === `/notes/${n.id}`;
            return (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                    active
                      ? "bg-accent/10 font-medium"
                      : "hover:bg-foreground/5"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {cleanTitle(n.title)}
                  </span>
                  <LifetimeBadge
                    updatedAt={n.updated_at}
                    lifetimeDays={n.lifetime_days}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
        <Link href="/archive" className="hover:text-foreground">
          Archivo
        </Link>
        <Link href="/settings" className="hover:text-foreground">
          Ajustes
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="hover:text-foreground">
            Salir
          </button>
        </form>
      </div>
    </aside>
  );
}

function cleanTitle(title: string): string {
  const clean = title
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+(\[( |x|X)\]\s+)?/, "")
    .replace(/[*_`~]/g, "")
    .trim();
  return clean || "Sin título";
}
