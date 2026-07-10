import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TokenManager } from "@/components/TokenManager";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: tokens } = await supabase
    .from("api_tokens")
    .select("id, name, created_at, last_used_at")
    .order("created_at", { ascending: false });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const mcpUrl = `${site}/api/mcp`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Ajustes</h1>
        <Link href="/notes" className="text-sm text-muted hover:text-foreground">
          ← Volver a notas
        </Link>
      </div>

      <section>
        <h2 className="text-base font-semibold">Tokens API (MCP)</h2>
        <p className="mt-1 text-sm text-muted">
          Con un token, Claude puede buscar, leer, crear y editar tus notas via
          MCP.
        </p>
        <div className="mt-4">
          <TokenManager tokens={tokens ?? []} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">Conectar con Claude</h2>
        <p className="mt-1 text-sm text-muted">
          Endpoint MCP (Streamable HTTP): <code className="font-mono">{mcpUrl}</code>
        </p>
        <div className="mt-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium text-muted">Claude Code</p>
          <pre className="mt-1 overflow-x-auto font-mono text-xs leading-relaxed">
            {`claude mcp add --transport http notas ${mcpUrl} \\
  --header "Authorization: Bearer <tu-token>"`}
          </pre>
        </div>
        <p className="mt-3 text-xs text-muted">
          Tools disponibles: search_notes, get_note, create_note, update_note,
          append_to_note, archive_note, restore_note, list_todos, complete_todo,
          get_lifetime_report.
        </p>
      </section>
    </main>
  );
}
