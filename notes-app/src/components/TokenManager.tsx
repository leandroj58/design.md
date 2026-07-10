"use client";

import { useState } from "react";
import { createApiToken, revokeApiToken } from "@/app/settings/actions";

type TokenRow = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

export function TokenManager({ tokens }: { tokens: TokenRow[] }) {
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      {newToken && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
          <p className="font-medium">
            Copiá el token ahora — no se vuelve a mostrar:
          </p>
          <code className="mt-2 block break-all rounded bg-surface p-2 font-mono text-xs">
            {newToken}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(newToken)}
            className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
          >
            Copiar token
          </button>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const { token } = await createApiToken(name);
            setNewToken(token);
            setName("");
          } finally {
            setBusy(false);
          }
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (ej: Claude Code)"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Generar token
        </button>
      </form>

      <ul className="mt-4 flex flex-col gap-2">
        {tokens.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-sm"
          >
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-muted">
                Creado {new Date(t.created_at).toLocaleDateString("es")} · Último
                uso:{" "}
                {t.last_used_at
                  ? new Date(t.last_used_at).toLocaleString("es")
                  : "nunca"}
              </p>
            </div>
            <button
              onClick={() => revokeApiToken(t.id)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
            >
              Revocar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
