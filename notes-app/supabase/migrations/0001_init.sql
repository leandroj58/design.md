-- Esquema inicial: notas con Note Lifetime, todos materializados y tokens API para MCP.
-- Ejecutar en el SQL Editor de Supabase (o via supabase db push).

-- pg_cron para el archivado automático (en Supabase también se puede habilitar
-- desde Dashboard → Database → Extensions → pg_cron).
create extension if not exists pg_cron;

-- ---------------------------------------------------------------- notes
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_md    text not null default '',
  title         text generated always as (split_part(content_md, e'\n', 1)) stored,
  status        text not null default 'active' check (status in ('active', 'archived')),
  lifetime_days int  not null default 30 check (lifetime_days between 1 and 365),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz,
  search_tsv    tsvector generated always as (to_tsvector('spanish', content_md)) stored
);

create index notes_search_idx on public.notes using gin (search_tsv);
create index notes_owner_status_idx on public.notes (owner_id, status, updated_at desc);

-- updated_at solo se actualiza cuando cambia el contenido: es la base del
-- Note Lifetime (archivar/restaurar no debe tocarlo salvo que lo hagamos explícito).
create or replace function public.notes_bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.content_md is distinct from old.content_md then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create trigger notes_bump_updated_at
  before update on public.notes
  for each row
  execute function public.notes_bump_updated_at();

-- ---------------------------------------------------------------- todos
-- Materializados desde content_md en cada guardado (líneas "- [ ]" / "- [x]").
create table public.todos (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  line_no    int  not null,
  text       text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (note_id, line_no)
);

create index todos_owner_done_idx on public.todos (owner_id, done);

-- ---------------------------------------------------------------- api_tokens
-- Tokens personales para el servidor MCP. Solo se guarda el hash SHA-256.
create table public.api_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

-- ---------------------------------------------------------------- RLS
alter table public.notes      enable row level security;
alter table public.todos      enable row level security;
alter table public.api_tokens enable row level security;

create policy notes_own on public.notes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy todos_own on public.todos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy api_tokens_own on public.api_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- Note Lifetime
-- Job diario (06:05 UTC): archiva notas activas sin ediciones dentro de su lifetime.
select cron.schedule(
  'note-lifetime',
  '5 6 * * *',
  $$
    update public.notes
       set status = 'archived', archived_at = now()
     where status = 'active'
       and updated_at < now() - make_interval(days => lifetime_days)
  $$
);
