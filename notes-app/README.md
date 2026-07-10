# Notas

Webapp interna de notas inspirada en [minimal.app](https://minimal.app): escritura markdown con estilos en vivo (estilo Notion), **Note Lifetime** (las notas sin editar se archivan solas), botón **Copiar .md**, y un **servidor MCP** para que Claude lea y escriba tus notas.

**Stack:** Next.js + TipTap · Supabase (Postgres, Auth, pg_cron) · Railway (deploy) · MCP via Streamable HTTP.

## Features

- **Markdown en vivo:** escribí `# `, `- `, `[] `, `**negrita**`, `` `código` ``, `> ` y el estilo aparece al instante. El markdown es la fuente de verdad (lo que se guarda es `.md`).
- **Note Lifetime:** cada nota tiene una vida (default 30 días, configurable de 7 a 365). Si no la editás en ese tiempo, un job diario de `pg_cron` la archiva. El archivo se busca y se restaura con un clic.
- **Copiar .md:** un botón copia el markdown completo al portapapeles.
- **Todos:** checkboxes en cualquier nota, consultables de forma agregada por Claude.
- **MCP para Claude:** `search_notes`, `get_note`, `create_note`, `update_note`, `append_to_note`, `archive_note`, `restore_note`, `list_todos`, `complete_todo`, `get_lifetime_report`.
- **Login con magic link** (sin contraseñas), con allowlist opcional de emails/dominios.

## Setup

### 1. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutá `supabase/migrations/0001_init.sql` (crea tablas, RLS y el job de pg_cron).
   - Si `create extension pg_cron` falla, habilitala primero en **Database → Extensions**.
3. En **Authentication → URL Configuration**:
   - **Site URL:** la URL pública de la app (ej. `https://notes-production.up.railway.app`).
   - Agregá `https://<tu-dominio>/auth/confirm` a **Redirect URLs**.
4. En **Authentication → Email Templates → Magic Link**, usá un enlace con `token_hash` (requerido por el flujo server-side de `@supabase/ssr`):

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Entrar a Notas</a>
   ```

5. Copiá de **Project Settings → API**: URL del proyecto, `anon key` y `service_role key`.

> Nota: el SMTP built-in de Supabase tiene límite de ~2 emails/hora y es solo para desarrollo. Para uso real configurá un SMTP propio (Resend, Postmark, etc.) en **Authentication → SMTP Settings**.

### 2. Railway

1. Creá un proyecto nuevo → **Deploy from GitHub repo** → este repo. Railway detecta el `Dockerfile`.
2. En **Variables**, cargá (ver `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` → la URL pública del servicio
   - `ALLOWED_EMAILS` (recomendado) → emails que pueden entrar, separados por coma
3. En **Settings → Networking → Generate Domain** generá el dominio público (`*.up.railway.app`) y actualizá `NEXT_PUBLIC_SITE_URL` y la Site URL de Supabase con ese valor.

### 3. Conectar con Claude

1. En la app, andá a **Ajustes → Tokens API (MCP)** y generá un token (`nk_...`).
2. En Claude Code:

   ```bash
   claude mcp add --transport http notas https://<tu-dominio>/api/mcp \
     --header "Authorization: Bearer nk_..."
   ```

3. Probá con: *"Buscá en mis notas..."*, *"Creá una nota con..."*, *"¿Qué todos tengo pendientes?"*, *"¿Qué notas están por archivarse?"*.

## Desarrollo local

```bash
cp .env.example .env.local   # completar con las claves de Supabase
npm install
npm run dev
```

## Estructura

```
supabase/migrations/   Esquema SQL (notas, todos, tokens, RLS, pg_cron)
src/app/notes/         Lista + editor (TipTap)
src/app/archive/       Archivo: buscar, restaurar, borrar
src/app/settings/      Tokens API + instrucciones MCP
src/app/api/[transport]/  Endpoint MCP (Streamable HTTP en /api/mcp)
src/lib/mcp/           Auth por token + definición de tools
src/lib/markdown.ts    Título, parsing de todos, Note Lifetime
docs/plan.md           Plan y análisis de minimal.app
```
