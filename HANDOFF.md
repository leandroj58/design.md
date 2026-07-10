# HANDOFF — App de notas interna ("notes") · continuación de sesión anterior

Pegá este documento al inicio de la nueva sesión de Claude Code. Contiene todo el contexto, el estado actual y las tareas pendientes.

## 1. Qué es este proyecto

Webapp interna de notas inspirada en **minimal.app**, para un solo usuario (Lea, `leojuarez58@gmail.com`, GitHub `leandroj58`). Decisiones ya tomadas (NO re-discutir):

- **Sin colaboración** ni publicación como sitio. Compartir = botón **"Copiar .md"** al portapapeles.
- **Editor estilo Notion**: se escribe markdown (`# `, `- `, `[] `, `**b**`, `` ` ``, `> `) y los estilos aparecen en vivo. **El markdown es la fuente de verdad** (columna `content_md`).
- **Note Lifetime** (feature insignia de minimal.app): las notas sin editar N días (default 30, rango 7–365 por nota) se archivan solas via **pg_cron dentro de Supabase**. Archivar ≠ borrar; el archivo se busca y restaura.
- **Login: magic link** de Supabase Auth (sin contraseñas), con allowlist `ALLOWED_EMAILS`.
- **Hosting: Railway** con dominio `*.up.railway.app` (sin dominio propio). **Base/Auth: Supabase**.
- **MCP para Claude**: servidor Streamable HTTP en `/api/mcp`, auth por tokens bearer `nk_...` generados en la página Ajustes de la app.

## 2. Estado actual del código: COMPLETO y compilando

La **Fase 1 está terminada** (`next build` pasa sin errores). Stack: Next.js 16 (App Router, TS, Tailwind v4), TipTap v3 + `tiptap-markdown`, `@supabase/ssr`, `mcp-handler` + `@modelcontextprotocol/sdk`, Dockerfile standalone para Railway.

Implementado: editor con autoguardado (debounce 800ms) e indicador de estado · botón Copiar .md (editor y archivo) · selector de vida por nota + badge de días restantes · sidebar con búsqueda full-text (español) · archivo con restaurar/borrar · login magic link + middleware + allowlist · página Ajustes con tokens API (hasheados SHA-256, revocables) e instrucciones de conexión · endpoint MCP con 10 tools: `search_notes`, `get_note`, `create_note`, `update_note`, `append_to_note`, `archive_note`, `restore_note`, `list_todos`, `complete_todo`, `get_lifetime_report` · todos materializados en tabla propia (checkboxes extraídos del markdown en cada guardado) · migración SQL completa (tablas, RLS, trigger de updated_at solo-si-cambia-contenido, job pg_cron) · README con guía de deploy paso a paso · plan original en `docs/plan.md`.

## 3. DÓNDE ESTÁ EL CÓDIGO y primera tarea: moverlo a su repo

La sesión anterior no tenía acceso de push a `leandroj58/notes`, así que el código quedó en dos lugares:

1. **Repo `leandroj58/design.md`, rama `claude/internal-webapp-claude-mcp-px22lr`, carpeta `notes-app/`** ← copia canónica completa.
2. Un `notes.zip` que el usuario descargó (mismo contenido; puede que ya lo haya pusheado a `notes` — verificar).

**Primera tarea de esta sesión** (necesita acceso a AMBOS repos — al crear la sesión elegir `notes`, y `design.md` si se puede; si no, `add_repo`):

```bash
# 0. Verificar si notes ya tiene el código (por si el usuario pusheó el zip).
#    Si main ya tiene src/ y package.json → saltar a la sección 4.

# 1. Traer el código desde design.md
git clone <design.md> && cd design.md && git checkout claude/internal-webapp-claude-mcp-px22lr

# 2. Copiarlo al repo notes (rama main) y pushear
git clone <notes> /path/notes
cp -r notes-app/. /path/notes/
cd /path/notes && git add -A && git commit -m "feat: app de notas con markdown en vivo, Note Lifetime y servidor MCP"
git push -u origin main

# 3. Limpieza: borrar notes-app/ y HANDOFF.md de la rama de design.md
#    (eran solo el vehículo de transferencia) y pushear.
```

Verificar tras el paso 2: `npm install && npm run build` debe pasar.

## 4. Configuración de deploy (guía completa en el README del proyecto)

### Supabase
1. Crear proyecto → SQL Editor → ejecutar `supabase/migrations/0001_init.sql` entero (si falla `create extension pg_cron`, habilitarla antes en Database → Extensions).
2. Authentication → URL Configuration: **Site URL** = URL pública de Railway; agregar `https://<dominio>/auth/confirm` a Redirect URLs.
3. Authentication → Email Templates → **Magic Link** — reemplazar el enlace por (imprescindible para el flujo server-side de `@supabase/ssr`):
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Entrar a Notas</a>
   ```
4. El SMTP built-in permite ~2 emails/hora (solo pruebas). Para uso real: SMTP propio (Resend/Postmark) en Authentication → SMTP Settings.

### Railway
1. New Project → Deploy from GitHub repo → `leandroj58/notes` (detecta el `Dockerfile`).
2. Variables (plantilla en `.env.example`):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ídem |
| `SUPABASE_SERVICE_ROLE_KEY` | ídem (secreta; la usa solo el MCP) |
| `NEXT_PUBLIC_SITE_URL` | dominio público de Railway |
| `ALLOWED_EMAILS` | `leojuarez58@gmail.com` |

3. Settings → Networking → **Generate Domain** → actualizar `NEXT_PUBLIC_SITE_URL` aquí y la Site URL en Supabase → redeploy.

### Conectar Claude via MCP
En la app: Ajustes → generar token. Luego:
```bash
claude mcp add --transport http notas https://<dominio>/api/mcp \
  --header "Authorization: Bearer nk_..."
```

## 5. Detalles técnicos que conviene saber (gotchas ya resueltos)

- `mcp-handler@1.1.0` exige exactamente `@modelcontextprotocol/sdk@1.26.0` y zod v3 (`zod@^3.25`) — no subir el SDK ni pasar a zod v4 sin migrar mcp-handler.
- El storage de `tiptap-markdown` no está tipado para TipTap v3: en `src/components/Editor.tsx` hay un helper `getMarkdown()` con cast — no "simplificarlo".
- El trigger `notes_bump_updated_at` solo actualiza `updated_at` si cambia `content_md` (base del Lifetime). Restaurar una nota setea `updated_at` explícitamente para renovarle la vida.
- El endpoint MCP vive en `src/app/api/[transport]/route.ts` con `basePath: "/api"` → URL final `/api/mcp`. La ruta `/api/sse` requeriría Redis — no usar/documentar solo streamable HTTP.
- El middleware excluye `/api` (el MCP se autentica solo con bearer) y `/login`, `/auth`.
- Next 16 avisa que `middleware.ts` está deprecado a favor de `proxy.ts` — funciona igual; migrar cuando haya tiempo.
- `.gitignore` lleva `!.env.example` (el `.env*` de create-next-app lo excluía).
- El usuario es principiante con git/GitHub: dar instrucciones paso a paso, en español.

## 6. Backlog (Fase 2, en orden)

1. Vista agregada "Mis todos" en la UI.
2. Slash commands (`/`) en el editor + paleta Cmd+K (buscar/crear).
3. Export/backup: zip con todos los `.md`.
4. Email de aviso N días antes del auto-archivado (Resend).
5. (Opcional) OAuth 2.1 en el MCP para usarlo como custom connector en claude.ai — `mcp-handler` ya trae `withMcpAuth`/`protectedResourceHandler` para esto.
6. PWA/offline básico.
