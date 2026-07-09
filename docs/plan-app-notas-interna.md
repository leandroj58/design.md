# Plan: App interna de notas (inspirada en minimal.app) con integración MCP para Claude

**Fecha:** 2026-07-09
**Objetivo:** Construir una webapp de notas de uso interno, accesible desde el navegador, replicando las funcionalidades clave de Minimal (minimal.app) y conectable a Claude mediante un servidor MCP.

---

## 1. Análisis de minimal.app

Minimal ("Minimal | Writing + Notes", de Arthur Van Siclen) es una app de escritura y notas de diseño minimalista, "inspirada en la meditación", disponible para iPhone, iPad, Mac y Apple Watch. Es una app nativa de Apple (no tiene versión web), con modelo de membresía (~USD 1.99/mes o 19.99/año, familiar 79.99/año, con prueba gratuita).

### Inventario de features

| # | Feature | Descripción |
|---|---------|-------------|
| 1 | **Note Lifetime** (feature insignia) | Las notas que no se editan durante un tiempo se **archivan automáticamente**. El cuaderno activo siempre refleja "el momento presente": queda fresco y ordenado sin esfuerzo manual. Lo archivado no se pierde, se puede recuperar. |
| 2 | **Formato estilo Markdown** | Formateo en vivo mientras se escribe usando caracteres especiales (títulos, negrita, listas, etc.). "Beautiful formatting" con tipografía cuidada. |
| 3 | **Todos** | Checkboxes/tareas dentro de las notas. |
| 4 | **Todos → Calendario** | Cada todo puede sincronizarse con el calendario de Apple como evento propio, con hora de inicio/fin y alertas. |
| 5 | **Notas colaborativas** | Compartir notas con permisos de **solo lectura** o **lectura + edición**. Sincronización automática entre participantes con soporte offline completo. |
| 6 | **Publicar como sitio web** | Convertir una nota en una página web pública "en tres taps": se escribe el texto y se publica como sitio simple y estético. |
| 7 | **Sync multiplataforma** | Sincronización en la nube entre Mac, iPhone, iPad y Apple Watch, offline-first. |
| 8 | **Compartir** | Compartir por iMessage y enviar como email. |
| 9 | **Diseño sustractivo / sin distracciones** | UI extremadamente reducida: una lista de notas + editor, sin carpetas complejas ni menús cargados. El foco es escribir. |
| 10 | **Archivo consultable** | Las notas archivadas (manual o automáticamente por Lifetime) siguen disponibles y buscables. |
| 11 | **Membresía** | Las mejores features (colaboración, publicación, sync) son de pago. *(No aplica a nuestra versión interna.)* |

**Fuentes:** [minimal.app](https://minimal.app/), [App Store — Minimal | Notes](https://apps.apple.com/us/app/minimal-notes/id1442727443), [blog.minimal.app](https://blog.minimal.app/about/), [Building Minimal Notes (Medium)](https://medium.com/minimal-notes/building-minimal-notes-7cd3334df899), [Building Collaborative Notes (Medium)](https://medium.com/minimal-notes/building-collaborative-notes-a2fcc57074de).

### Qué la hace distinta (y qué conviene copiar)

- **El archivado automático (Note Lifetime) es el diferenciador.** Es barato de implementar (un job periódico) y de alto valor para uso interno: el espacio de trabajo nunca se llena de notas muertas.
- **La simplicidad es la feature.** Sin carpetas, sin tags obligatorios, sin configuración: lista de notas activas + editor + archivo.
- **Publicar como página** se traduce muy bien a un contexto interno: compartir una nota como URL de solo lectura dentro de la organización.

---

## 2. Alcance de nuestra app interna

**Es:** una webapp (navegador, desktop y mobile-responsive) para el equipo, con login interno, notas markdown con lifetime automático, todos, compartir/publicar internamente, y un servidor MCP para que Claude pueda leer y escribir notas.

**No es (por ahora):** apps nativas, Apple Watch, facturación/membresías, sync con Apple Calendar (se reemplaza por export iCal/integración calendario propio en fase posterior).

### Mapeo de features Minimal → versión interna

| Feature Minimal | Versión interna | Fase |
|---|---|---|
| Note Lifetime | Job diario que archiva notas sin editar hace N días (configurable por usuario, default 30; aviso visual de "días de vida restantes" en cada nota) | 1 |
| Formato Markdown en vivo | Editor WYSIWYG-markdown (TipTap) con atajos `#`, `**`, `-`, `[]` | 1 |
| Todos | Checkboxes en notas + vista agregada "Mis todos" de todas las notas | 1 |
| Todos → Calendario | Export iCal (.ics) por usuario / feed suscribible | 3 |
| Notas colaborativas | Compartir con usuarios internos: lectura o edición. Edición colaborativa en tiempo real (Yjs) | 2 |
| Publicar como sitio web | "Publicar" genera URL interna de solo lectura, con render limpio; opcional token público | 2 |
| Sync multiplataforma | Es web: estado en servidor. PWA + soporte offline básico (fase 3) | 1/3 |
| Compartir iMessage/email | Copiar link + enviar por email | 2 |
| Diseño sin distracciones | UI de dos paneles (lista + editor), tema claro/oscuro, cero configuración inicial | 1 |
| Archivo | Vista "Archivo" con búsqueda full-text y restauración | 1 |
| — | **Servidor MCP para Claude** (nuevo, no existe en Minimal) | 1 |

---

## 3. Arquitectura propuesta

```
┌─────────────┐     HTTPS      ┌──────────────────────────────┐
│  Navegador  │ ─────────────▶ │  Next.js (App Router)        │
│  (React UI) │                │  ├─ UI (React + TipTap)      │
└─────────────┘                │  ├─ API interna (route hdlrs)│
                               │  └─ /mcp  ← MCP Streamable   │
┌─────────────┐   Streamable   │          HTTP endpoint       │
│ Claude      │ ─────HTTP────▶ │                              │
│ (Code/      │                └───────────┬──────────────────┘
│  Desktop/   │                            │
│  claude.ai) │                ┌───────────▼──────────┐   ┌──────────────┐
└─────────────┘                │ PostgreSQL (+ FTS)   │   │ Cron diario  │
                               └──────────────────────┘   │ (lifetime)   │
                                                          └──────────────┘
```

### Stack

- **Frontend + backend:** **Next.js 15 + TypeScript** (una sola app desplegable; API via route handlers). Alternativa si se prefiere separar: React/Vite + Fastify.
- **Editor:** **TipTap** (ProseMirror) con extensión de markdown shortcuts y task lists. Preparado para colaboración con Yjs en fase 2.
- **Base de datos:** **PostgreSQL** con `tsvector` para búsqueda full-text (español). Prisma o Drizzle como ORM.
- **Auth:** email interno + magic link, o SSO de la organización (Google Workspace) vía Auth.js. Sesiones con cookies httpOnly.
- **Note Lifetime:** cron diario (Vercel Cron / node-cron / systemd timer) que mueve a `archived` las notas con `updated_at < now() - lifetime_days`.
- **Tiempo real (fase 2):** Yjs + y-websocket (o PartyKit/Liveblocks si se prefiere gestionado).
- **MCP:** **`@modelcontextprotocol/sdk`** (TypeScript) expuesto como **Streamable HTTP** en `/mcp`.
- **Deploy:** Docker Compose en servidor interno, o Vercel + Postgres gestionado. HTTPS obligatorio (requisito para conectores MCP remotos).

### Modelo de datos

```
users(id, email, name, created_at)
notes(id, owner_id, title, content_md, content_json, status[active|archived|deleted],
      lifetime_days, published_slug nullable, publish_public bool,
      created_at, updated_at, archived_at, search_tsv)
note_shares(note_id, user_id, role[viewer|editor], created_at)
todos(id, note_id, position, text, done, due_at nullable, done_at)   -- derivados del contenido o tabla propia
api_tokens(id, user_id, name, token_hash, scopes, last_used_at)      -- para MCP
```

Notas de diseño:
- `title` = primera línea de la nota (como Minimal: sin campo separado).
- Los todos se extraen del documento (nodos taskItem de TipTap) y se materializan en la tabla `todos` al guardar, para poder consultarlos de forma agregada y desde MCP.
- `archived` ≠ `deleted`: el archivo se conserva y se busca; borrar es explícito.

---

## 4. Integración MCP con Claude

Un **servidor MCP remoto (Streamable HTTP)** montado en la misma app en `/mcp`, de modo que se pueda conectar desde:

- **Claude Code:** `claude mcp add --transport http notas https://notas.interna.tld/mcp`
- **Claude Desktop / claude.ai:** como *custom connector* (Settings → Connectors → Add custom connector).

### Autenticación

- **Fase 1 (simple):** tokens API personales (bearer) generados desde la UI (`api_tokens`), pasados como header. Suficiente para Claude Code y uso interno.
- **Fase 2 (correcto para claude.ai):** OAuth 2.1 con el flujo de autorización que soportan los conectores remotos de Claude (el SDK de MCP trae soporte de auth). Cada usuario conecta su propia cuenta, y el servidor MCP opera con sus permisos.

### Herramientas (tools) expuestas

| Tool | Descripción |
|---|---|
| `search_notes(query, include_archived?)` | Búsqueda full-text; devuelve id, título, snippet, estado |
| `get_note(id)` | Contenido markdown completo + metadatos |
| `create_note(content_md)` | Crea nota (título = primera línea) |
| `update_note(id, content_md | append)` | Edita o agrega al final |
| `archive_note(id)` / `restore_note(id)` | Gestión de archivo |
| `list_todos(filter: open|done|all, due_before?)` | Todos agregados de todas las notas del usuario |
| `complete_todo(id)` | Marca un todo como hecho |
| `publish_note(id)` / `unpublish_note(id)` | Genera/revoca la URL de solo lectura |
| `get_lifetime_report()` | Notas próximas a archivarse (útil para "¿qué está por vencer?") |

### Recursos y prompts MCP (opcional, fase 2)

- **Resources:** `note://{id}` para que Claude pueda referenciar notas como contexto.
- **Prompts:** plantillas tipo "resumí mis notas de esta semana", "convertí esta nota en minuta".

### Casos de uso con Claude

- "Buscá en mis notas qué decidimos sobre X y resumílo."
- "Creá una nota con la minuta de esta conversación."
- "¿Qué todos tengo pendientes con vencimiento esta semana?"
- "Archivá las notas del proyecto Y que ya cerramos."

---

## 5. Roadmap por fases

### Fase 1 — MVP (2–3 semanas de trabajo efectivo)
1. Scaffold Next.js + Postgres + auth (magic link o Google SSO).
2. CRUD de notas + editor TipTap con markdown shortcuts y task lists.
3. Lista de notas activas / vista Archivo / búsqueda full-text.
4. **Note Lifetime**: cron de archivado + indicador de vida en la UI + configuración por usuario.
5. Vista agregada de todos.
6. **Servidor MCP** en `/mcp` con tokens bearer y las tools básicas (`search`, `get`, `create`, `update`, `archive`, `list_todos`, `complete_todo`).
7. Deploy interno con HTTPS + docs de conexión a Claude Code/Desktop.

### Fase 2 — Colaboración y publicación (2–3 semanas)
1. Compartir notas (viewer/editor) + página "Compartidas conmigo".
2. Edición colaborativa en tiempo real (Yjs).
3. Publicar como página interna de solo lectura (slug + render limpio); opción de link con token.
4. OAuth 2.1 en el MCP para conectarlo como custom connector en claude.ai.
5. Resources y prompts MCP.

### Fase 3 — Pulido (1–2 semanas)
1. PWA + offline básico (cache de notas recientes, cola de escritura).
2. Export iCal de todos con fecha (equivalente al "Todos → Calendar" de Minimal).
3. Notificación (email/Slack) previa al auto-archivado.
4. Export/backup de todas las notas (markdown zip).

### Decisiones abiertas
- **¿SSO Google o magic link?** (depende de qué use la organización)
- **¿Vercel o servidor propio con Docker?** (si el MCP debe ser accesible desde claude.ai, necesita URL pública con HTTPS)
- **¿Colaboración en tiempo real es requisito o alcanza con "último guardado gana" + lock suave?** (simplificaría mucho la fase 2)

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Auto-archivado archiva algo importante | Aviso visual + notificación previa + restauración en un clic; nunca borra |
| Conflictos de edición concurrente (antes de Yjs) | Guardado optimista con detección de versión (`updated_at` check) y merge manual |
| Seguridad del endpoint MCP | HTTPS, tokens con scopes, rate limiting, tools siempre acotadas al usuario autenticado |
| Alcance crece (se vuelve "otro Notion") | Mantener el principio de Minimal: sin carpetas, sin tipos de bloque exóticos; el lifetime mantiene el orden |
