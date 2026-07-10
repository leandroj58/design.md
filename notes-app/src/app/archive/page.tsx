import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArchivedRow } from "@/components/ArchivedRow";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("notes")
    .select("id, content_md, archived_at")
    .eq("status", "archived")
    .order("archived_at", { ascending: false })
    .limit(100);

  if (q?.trim()) {
    query = query.textSearch("search_tsv", q, {
      type: "websearch",
      config: "spanish",
    });
  }

  const { data: notes } = await query;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Archivo</h1>
        <Link href="/notes" className="text-sm text-muted hover:text-foreground">
          ← Volver a notas
        </Link>
      </div>

      <form className="mb-6">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar en el archivo…"
          className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
        />
      </form>

      {!notes?.length ? (
        <p className="text-sm text-muted">
          {q ? "Sin resultados." : "El archivo está vacío."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <ArchivedRow key={n.id} note={n} />
          ))}
        </ul>
      )}
    </main>
  );
}
