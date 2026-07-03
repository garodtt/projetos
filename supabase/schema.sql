-- ============================================================
-- Gestão de Projetos — schema completo
-- Rode este arquivo inteiro em um projeto Supabase NOVO e VAZIO.
-- Não execute isso em um banco que já tenha essas tabelas.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
create type activity_type as enum ('reuniao', 'melhoria', 'correcao');

-- ------------------------------------------------------------
-- Pastas (agrupam projetos na barra lateral)
-- ------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Projetos
-- ------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.folders(id) on delete set null,
  name text not null,
  description text,
  objectives text,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.projects(folder_id);

-- ------------------------------------------------------------
-- Atividades (reuniões, melhorias e correções)
-- ------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type activity_type not null,
  person_name text not null,
  activity_date date not null default current_date,
  description text not null,
  status text check (status is null or status in ('pendente', 'em_andamento', 'concluido')),
  created_at timestamptz not null default now()
);

create index on public.activities(project_id);

-- ------------------------------------------------------------
-- Colunas do quadro (Kanban)
-- ------------------------------------------------------------
create table public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  position int not null default 0,
  is_indicator boolean not null default false,
  color text,
  created_at timestamptz not null default now()
);

create index on public.kanban_columns(project_id);

-- ------------------------------------------------------------
-- Itens do quadro (tarefas / versões)
-- ------------------------------------------------------------
create table public.versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  column_id uuid references public.kanban_columns(id),
  version_label text not null,
  requester_name text not null,
  change_date date not null default current_date,
  description text,
  priority text not null default 'normal' check (priority in ('normal', 'urgente')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index on public.versions(project_id);
create index on public.versions(column_id);

-- ------------------------------------------------------------
-- Painel livre (diagramas, notas e imagens/arquivos arrastáveis)
-- ------------------------------------------------------------
create table public.panel_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null default 'diagrama' check (type in ('diagrama', 'nota', 'imagem')),
  title text,
  diagram_xml text,
  diagram_svg text,
  note_text text,
  note_color text default '#fef08a',
  attachment_url text,
  attachment_name text,
  pos_x integer not null default 0,
  pos_y integer not null default 0,
  width integer,
  height integer,
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.panel_items(project_id);

-- ------------------------------------------------------------
-- Anexos (múltiplos arquivos por atividade ou por item do quadro)
-- ------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  version_id uuid references public.versions(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  constraint attachments_one_parent check (
    (activity_id is not null and version_id is null) or
    (activity_id is null and version_id is not null)
  )
);

create index on public.attachments(project_id);
create index on public.attachments(activity_id);
create index on public.attachments(version_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.folders enable row level security;
alter table public.projects enable row level security;
alter table public.activities enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.versions enable row level security;
alter table public.panel_items enable row level security;
alter table public.attachments enable row level security;

create policy "allow all - folders" on public.folders for all using (true) with check (true);
create policy "allow all - projects" on public.projects for all using (true) with check (true);
create policy "allow all - activities" on public.activities for all using (true) with check (true);
create policy "allow all - kanban_columns" on public.kanban_columns for all using (true) with check (true);
create policy "allow all - versions" on public.versions for all using (true) with check (true);
create policy "allow all - panel_items" on public.panel_items for all using (true) with check (true);
create policy "allow all - attachments" on public.attachments for all using (true) with check (true);

-- ------------------------------------------------------------
-- Storage — bucket para anexos e arquivos do painel
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "leitura - attachments" on storage.objects for select using (bucket_id = 'attachments');
create policy "upload - attachments" on storage.objects for insert with check (bucket_id = 'attachments');
create policy "update - attachments" on storage.objects for update using (bucket_id = 'attachments');
create policy "delete - attachments" on storage.objects for delete using (bucket_id = 'attachments');