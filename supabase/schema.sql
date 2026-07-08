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
  deleted_at timestamptz,
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
  version_major integer not null default 1,
  version_minor integer not null default 0,
  version_patch integer not null default 0,
  version_threshold_grande integer not null default 1,
  version_threshold_media integer not null default 1,
  version_threshold_minima integer not null default 1,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.projects(folder_id);

-- ------------------------------------------------------------
-- Colunas do quadro Kanban
-- ------------------------------------------------------------
create table public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  position int not null default 0,
  is_indicator boolean not null default false,
  is_version_column boolean not null default false,
  color text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.kanban_columns(project_id);

-- ------------------------------------------------------------
-- Itens do quadro Kanban (tarefas)
-- ------------------------------------------------------------
create table public.versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  column_id uuid references public.kanban_columns(id),
  title text not null,
  requester_name text not null,
  assignee_name text,
  change_date date not null default current_date,
  description text,
  priority text not null default 'normal' check (priority in ('normal', 'urgente')),
  complexity text not null default 'media' check (complexity in ('minima', 'media', 'grande')),
  position integer not null default 0,
  counted_in_version boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.versions(project_id);
create index on public.versions(column_id);

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
  title text,
  complexity text check (complexity is null or complexity in ('minima', 'media', 'grande')),
  priority text check (priority is null or priority in ('normal', 'urgente')),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.activities(project_id);

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
-- Painel livre (diagramas, notas e arquivos arrastáveis)
-- ------------------------------------------------------------
create table public.panel_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null default 'diagrama' check (type in ('diagrama', 'nota', 'imagem')),
  title text not null default 'Novo diagrama',
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
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.panel_items(project_id);

-- ------------------------------------------------------------
-- Cronograma: tarefas
-- ------------------------------------------------------------
create table public.schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  level integer not null default 0,
  position integer not null default 0,
  duration_value numeric not null default 1,
  duration_unit text not null default 'dias' check (duration_unit in ('horas', 'dias', 'semanas')),
  start_date date not null default current_date,
  end_date date not null default current_date,
  actual_start_date date,
  actual_end_date date,
  resource_names text,
  color text,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.schedule_tasks(project_id);

-- ------------------------------------------------------------
-- Cronograma: dependências entre tarefas (predecessoras)
-- ------------------------------------------------------------
create table public.schedule_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.schedule_tasks(id) on delete cascade,
  predecessor_id uuid not null references public.schedule_tasks(id) on delete cascade,
  lag_days numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (task_id, predecessor_id)
);

create index on public.schedule_dependencies(task_id);
create index on public.schedule_dependencies(predecessor_id);

-- ------------------------------------------------------------
-- Cronograma: recursos (pessoas/equipes alocáveis nas tarefas)
-- ------------------------------------------------------------
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  daily_capacity_hours numeric not null default 8,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Cronograma: alocação de recursos por tarefa (N:N)
-- ------------------------------------------------------------
create table public.schedule_task_resources (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.schedule_tasks(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  hours_per_day numeric not null default 8,
  created_at timestamptz not null default now(),
  unique (task_id, resource_id)
);

create index on public.schedule_task_resources(task_id);
create index on public.schedule_task_resources(resource_id);

-- Mantém schedule_tasks.resource_names (usado pela Busca Global e pelo
-- Cronograma Geral/por pasta) em sincronia automática com as alocações
-- reais em schedule_task_resources, pra não depender de cada tela que
-- mexe em alocação lembrar de atualizar esse campo também.
create or replace function public.sync_schedule_task_resource_names()
returns trigger as $$
begin
  update public.schedule_tasks
  set resource_names = (
    select nullif(string_agg(r.name, ', ' order by r.name), '')
    from public.schedule_task_resources str
    join public.resources r on r.id = str.resource_id
    where str.task_id = coalesce(new.task_id, old.task_id)
  )
  where id = coalesce(new.task_id, old.task_id);
  return null;
end;
$$ language plpgsql;

create trigger schedule_task_resources_sync_names
after insert or update or delete on public.schedule_task_resources
for each row execute function public.sync_schedule_task_resource_names();

-- ------------------------------------------------------------
-- Cronograma: configuração de dias úteis (linha única, id = 1)
-- ------------------------------------------------------------
create table public.schedule_settings (
  id integer primary key default 1 check (id = 1),
  daily_working_hours numeric not null default 8,
  saturday_is_business_day boolean not null default false,
  sunday_is_business_day boolean not null default false,
  use_national_holidays boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.schedule_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Cronograma: feriados personalizados (além dos feriados nacionais
-- calculados automaticamente no código quando use_national_holidays = true)
-- ------------------------------------------------------------
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (date)
);

-- ------------------------------------------------------------
-- Versionamento: itens acumulados aguardando atingir o limite
-- ------------------------------------------------------------
create table public.version_pending_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  level text not null check (level in ('grande', 'media', 'minima')),
  version_id uuid references public.versions(id) on delete set null,
  item_title text not null,
  created_at timestamptz not null default now()
);

create index on public.version_pending_items(project_id, level);

-- ------------------------------------------------------------
-- Versionamento: histórico de subidas de versão
-- ------------------------------------------------------------
create table public.version_bumps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  level text not null check (level in ('grande', 'media', 'minima')),
  version_label text not null,
  created_at timestamptz not null default now()
);

create index on public.version_bumps(project_id);

-- ------------------------------------------------------------
-- Versionamento: itens que compuseram cada subida de versão
-- ------------------------------------------------------------
create table public.version_bump_items (
  id uuid primary key default gen_random_uuid(),
  version_bump_id uuid not null references public.version_bumps(id) on delete cascade,
  version_id uuid references public.versions(id) on delete set null,
  item_title text not null,
  created_at timestamptz not null default now()
);

create index on public.version_bump_items(version_bump_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.folders enable row level security;
alter table public.projects enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.versions enable row level security;
alter table public.activities enable row level security;
alter table public.attachments enable row level security;
alter table public.panel_items enable row level security;
alter table public.schedule_tasks enable row level security;
alter table public.schedule_dependencies enable row level security;
alter table public.resources enable row level security;
alter table public.schedule_task_resources enable row level security;
alter table public.schedule_settings enable row level security;
alter table public.holidays enable row level security;
alter table public.version_pending_items enable row level security;
alter table public.version_bumps enable row level security;
alter table public.version_bump_items enable row level security;

create policy "allow all - folders" on public.folders for all using (true) with check (true);
create policy "allow all - projects" on public.projects for all using (true) with check (true);
create policy "allow all - kanban_columns" on public.kanban_columns for all using (true) with check (true);
create policy "allow all - versions" on public.versions for all using (true) with check (true);
create policy "allow all - activities" on public.activities for all using (true) with check (true);
create policy "allow all - attachments" on public.attachments for all using (true) with check (true);
create policy "allow all - panel_items" on public.panel_items for all using (true) with check (true);
create policy "allow all - schedule_tasks" on public.schedule_tasks for all using (true) with check (true);
create policy "allow all - schedule_dependencies" on public.schedule_dependencies for all using (true) with check (true);
create policy "allow all - resources" on public.resources for all using (true) with check (true);
create policy "allow all - schedule_task_resources" on public.schedule_task_resources for all using (true) with check (true);
create policy "allow all - schedule_settings" on public.schedule_settings for all using (true) with check (true);
create policy "allow all - holidays" on public.holidays for all using (true) with check (true);
create policy "allow all - version_pending_items" on public.version_pending_items for all using (true) with check (true);
create policy "allow all - version_bumps" on public.version_bumps for all using (true) with check (true);
create policy "allow all - version_bump_items" on public.version_bump_items for all using (true) with check (true);

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