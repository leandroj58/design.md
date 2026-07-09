# Plan: App interna de notas (inspirada en minimal.app) con integración MCP para Claude

**Fecha:** 2026-07-09 (v2 — ajustado a Supabase + Railway, sin colaboración)
**Objetivo:** Webapp de notas de uso interno, accesible desde el navegador, con escritura markdown estilo Notion (los estilos se aplican mientras escribís), archivado automático tipo Minimal, botón "Copiar .md" para compartir, y un servidor MCP para conectar con Claude.

---

## 1. Análisis de minimal.app

Minimal ("Minimal | Writing + Notes", de Arthur Van Siclen) es una app de escritura y notas de diseño minimalista, disponible solo para iPhone, iPad, Mac y Apple Watch (no tiene versión web), con modelo de membresía.

### Inventario de features de Minimal

| # | Feature | Descripción | ¿La adoptamos? |
|---|---------|-------------|----------------|
| 1 | **Note Lifetime** (insignia) | Las notas sin editar durante un tiempo se **archivan automáticamente**; el cuaderno activo siempre queda limpio. Lo archivado no se pierde. | ✅ Sí |
| 2 | **Formato Markdown en vivo** | Formateo mientras se escribe usando caracteres especiales. | ✅ Sí — es la prioridad #1, estilo Notion |
| 3 | **Todos** | Checkboxes/tareas dentro de las notas. | ✅ Sí |
| 4 | **Todos → Calendario Apple** | Cada todo se sincroniza como evento con alertas. | ❌ No (fuera de alcance) |
| 5 | **Notas colaborativas** | Compartir con permisos lectura/edición, sync en tiempo real. | ❌ No — se reemplaza por **botón "Copiar .md"** |
| 6 | **Publicar como sitio web** | Convertir nota en página pública. | ❌ No — el copy del .md cubre la necesidad |
| 7 | **Sync multiplataforma** | Nube entre dispositivos Apple, offline-first. | ✅ Implícito (es web: estado en servidor) |
| 8 | **Compartir iMessage/email** | Compartir nativo de Apple. | ❌ No — copiar y pegar donde sea |
| 9 | **Diseño sin distracciones** | Lista de notas + editor, sin carpetas ni menús. | ✅ Sí — principio rector |
| 10 | **Archivo consultable** | Notas archivadas disponibles y buscables. | ✅ Sí |
| 11 | **Membresía de pago** | Features premium. | ❌ No aplica (uso interno) |

**Fuentes:** [minimal.app](https://minimal.app/), [App Store](https://apps.apple.com/us/app/minimal-notes/id1442727443), [blog.minimal.app](https://blog.minimal.app/about/), [Building Minimal Notes](https://medium.com/minimal-notes/building-minimal-notes-7cd3334df899).

---

## 2. Alcance

**Es:** una webapp de una sola persona por nota (sin colaboración), centrada en:

1. **Escritura limpia estilo Notion:** escribís markdown (`#`, `**`, `-`, `[]`, `` ` ``) y los estilos aparecen al instante; nunca ves el markdown crudo, pero el documento *es* markdown por debajo.
2. **Note Lifetime:** archivado automático de notas inactivas.
3. **Botón "Copiar .md":** un clic copia el markdown completo de la nota al portapapeles para pegarlo donde quieras (Slack, email, Claude, otro editor).
4. **MCP:** Claude puede buscar, leer, crear y editar tus notas.

**No es:** colaboración en tiempo real, permisos compartidos, publicación como sitio, apps nativas, calendario.

---

## 3. Arquitectura: Supabase + Railway

```
┌─────────────┐    HTTPS    ┌─────────────────────────────────┐
│  Navegador  │ ──────────▶ │  Railway: Next.js (Docker)      │
│  React UI   │             │  ├─ UI (React + TipTap)         │
└─────────────┘             │  ├─ API (route handlers)        │
                            │  └─ /mcp (Streamable HTTP)      │
┌─────────────┐             └────────────┬────────────────────┘
│ Claude Code │  Streamable              │ supabase-js / Postgres
│ Claude.ai   │ ────HTTP───▶ /mcp        ▼
│ Desktop     │             ┌─────────────────────────────────┐
└─────────────┘             │  Supabase                       │
                            │  ├─ Postgres (+ FTS + RLS)      │
                            │  ├─ Auth (magic link / Google)  │
                            │  └─ pg_cron (Note Lifetime)     │
                            └─────────────────────────────────┘
```

### Reparto de responsabilidades

**Supabase:**
- **Postgres** con full-text search (`tsvector`, config `spanish`) y **Row Level Security** (cada usuario solo ve sus notas).
- **Supabase Auth:** magic link por email o Google OAuth. La UI usa `@supabase/ssr` para sesiones con cookies.
- **pg_cron + función SQL** para el Note Lifetime: un job diario dentro de la propia base archiva las notas vencidas — no hace falta ningún worker externo:
  ```sql
  select cron.schedule('note-lifetime', '0 6 * * *', $$
    update notes set status = 'archived', archived_at = now()
    where status = 'active'
      and updated_at < now() - (lifetime_days || ' days')::interval
  $$);
  ```

**Railway:**
- Un único servicio: la app **Next.js** (UI + API + endpoint MCP) desplegada desde el repo (Dockerfile o Nixpacks), con dominio propio y HTTPS automático — requisito para conectar el MCP a claude.ai.
- Variables de entorno: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo para el MCP server-side), `MCP_TOKEN_SECRET`.

### Stack de la app

- **Next.js 15 + TypeScript**, App Router.
- **Editor: TipTap** (ProseMirror) — es exactamente el motor de experiencia "tipo Notion":
  - *Input rules* de markdown: `# ` → H1, `- ` → lista, `[] ` → checkbox, `**x**` → negrita, `` ` `` → código, `> ` → cita, `---` → divisor.
  - Extensiones: StarterKit + TaskList/TaskItem + Placeholder + Typography.
  - Serialización bidireccional a markdown (`tiptap-markdown`): el estado canónico que se guarda en Supabase es **markdown**, lo que hace triviales el botón "Copiar .md" y las tools MCP.
  - Opcional para el toque Notion: menú `/` (slash commands) con la extensión Suggestion.
- **UI:** dos paneles (lista de notas | editor), tema claro/oscuro, tipografía cuidada, cero configuración. Indicador sutil de "vida restante" por nota.
- **Copiar .md:** botón en el editor → `navigator.clipboard.writeText(markdown)` + toast. También copia por nota desde la lista.

### Modelo de datos (Supabase)

```sql
-- auth.users la provee Supabase Auth

create table notes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id),
  content_md    text not null default '',            -- fuente de verdad
  title         text generated always as (split_part(content_md, E'\n', 1)) stored,
  status        text not null default 'active',      -- active | archived
  lifetime_days int  not null default 30,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  search_tsv    tsvector generated always as (to_tsvector('spanish', content_md)) stored
);
create index on notes using gin(search_tsv);

create table todos (              -- materializados desde content_md al guardar
  id        uuid primary key default gen_random_uuid(),
  note_id   uuid not null references notes(id) on delete cascade,
  owner_id  uuid not null references auth.users(id),
  position  int  not null,
  text      text not null,
  done      boolean not null default false,
  done_at   timestamptz
);

create table api_tokens (         -- para el MCP
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id),
  name         text not null,
  token_hash   text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

-- RLS en las tres tablas: owner_id = auth.uid()
```

Notas:
- `title` = primera línea del markdown (como Minimal, sin campo aparte).
- Al guardar una nota, la API re-extrae los checkboxes (`- [ ]` / `- [x]`) y sincroniza la tabla `todos`, para la vista agregada "Mis todos" y para las tools MCP. Marcar un todo desde MCP reescribe la línea correspondiente en `content_md`.

---

## 4. Integración MCP con Claude

**Servidor MCP remoto (Streamable HTTP)** en `/mcp`, dentro de la misma app Next.js en Railway, con `@modelcontextprotocol/sdk` (o `mcp-handler`, el adaptador para Next.js).

### Conexión

- **Claude Code:** `claude mcp add --transport http notas https://notas.up.railway.app/mcp --header "Authorization: Bearer <token>"`
- **Claude Desktop / claude.ai:** custom connector apuntando a la misma URL (Railway ya da HTTPS).

### Autenticación

- **Fase 1:** tokens personales (bearer) generados desde la UI (tabla `api_tokens`, se guarda solo el hash). El MCP resuelve el token → `user_id` y usa el service role de Supabase acotando cada query a ese usuario.
- **Fase 2 (si se quiere usar desde claude.ai con OAuth):** OAuth 2.1 apoyado en Supabase Auth.

### Tools

| Tool | Descripción |
|---|---|
| `search_notes(query, include_archived?)` | Full-text; devuelve id, título, snippet, estado |
| `get_note(id)` | Markdown completo + metadatos |
| `create_note(content_md)` | Crea nota (título = primera línea) |
| `update_note(id, content_md)` / `append_to_note(id, text)` | Edición |
| `archive_note(id)` / `restore_note(id)` | Gestión de archivo |
| `list_todos(filter: open\|done\|all)` | Todos agregados de todas las notas |
| `complete_todo(id)` | Marca hecho (actualiza el `- [ ]` en el markdown) |
| `get_lifetime_report()` | Notas próximas a auto-archivarse |

### Casos de uso

- "Buscá en mis notas qué decidimos sobre X y resumílo."
- "Creá una nota con la minuta de esta conversación."
- "¿Qué todos tengo pendientes?"
- "¿Qué notas están por archivarse esta semana?"

---

## 5. Roadmap

### Fase 1 — MVP (≈2 semanas)
1. Proyecto Supabase: schema + RLS + Auth (magic link / Google).
2. Next.js en Railway: login, lista de notas, editor TipTap con markdown en vivo (headings, listas, checkboxes, negrita/itálica, código, citas).
3. Guardado con debounce (`content_md` como fuente de verdad) + sincronización de `todos`.
4. **Botón "Copiar .md"** en editor y lista.
5. **Note Lifetime** con pg_cron + indicador de vida en la UI + `lifetime_days` configurable por nota.
6. Vista Archivo + búsqueda full-text + restaurar.
7. **Servidor MCP** en `/mcp` con tokens bearer y todas las tools de la tabla. Página de ajustes para generar/revocar tokens, con las instrucciones de conexión a Claude.

### Fase 2 — Pulido (≈1 semana)
1. Vista agregada "Mis todos".
2. Slash commands (`/`) en el editor y paleta de comandos (Cmd+K: buscar/crear).
3. Export completo (zip de .md) como backup.
4. Aviso por email (Supabase/Resend) N días antes del auto-archivado.
5. (Opcional) OAuth 2.1 para conectar el MCP como custom connector en claude.ai.

### Decisiones abiertas
- **Magic link vs. Google OAuth** para el login (¿la organización usa Google Workspace?).
- **Dominio:** ¿subdominio propio (`notas.tuempresa.com`) apuntando a Railway o el `*.up.railway.app`?

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Auto-archivado archiva algo importante | Indicador de vida + email previo + restauración en un clic; nunca borra |
| Pérdida de fidelidad markdown ↔ editor | `content_md` es la fuente de verdad; test round-trip (md → TipTap → md) sobre el subset soportado |
| Seguridad del endpoint MCP | HTTPS (Railway), tokens hasheados y revocables, rate limiting, queries siempre acotadas al dueño del token |
| Alcance crece | Principio Minimal: sin carpetas, sin bloques exóticos; el lifetime mantiene el orden |
