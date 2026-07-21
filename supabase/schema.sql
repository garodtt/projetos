-- ============================================================
-- Gestão de Projetos — schema completo
-- Rode este arquivo inteiro em um projeto Supabase NOVO e VAZIO.
-- Não execute isso em um banco que já tenha essas tabelas.
--
-- Login agora é obrigatório (políticas exigem auth.role() =
-- 'authenticated'). Depois de rodar este arquivo, crie pelo menos um
-- usuário em Authentication → Users antes de usar o app — sem isso,
-- ninguém consegue entrar.
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
-- Governança: áreas (BUs) e perfis de usuário
--
-- Fase 2a — só o modelo de dados. Ainda NÃO restringe quem vê o quê
-- (isso é a Fase 2c, feita separada e só depois de todo mundo já ter
-- área/papel configurados corretamente).
-- ------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.areas (name) values ('Geral') on conflict (name) do nothing;

-- Espelha auth.users (que o app não pode consultar direto, por segurança
-- do próprio Supabase) numa tabela que o app consegue ler/gerenciar.
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'usuario' check (role in ('usuario', 'admin')),
  created_at timestamptz not null default now()
);

-- Quais áreas cada usuário pode ver (N:N). Papel de admin, por convenção,
-- ignora essa tabela e vê todas as áreas — ver current_user_role() e a
-- função user_can_access_project(), que só chega na Fase 2c.
create table public.user_areas (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  primary key (user_id, area_id)
);

-- Toda vez que uma conta nova é criada (painel do Supabase ou convite),
-- espelha automaticamente pra user_profiles com papel padrão "usuario".
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, role)
  values (new.id, new.email, 'usuario')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Helper usado dentro de outras políticas (e futuramente em
-- user_can_access_project, na Fase 2c). É security definer de propósito:
-- lê user_profiles ignorando a RLS dela mesma, pra evitar recursão infinita
-- (uma política em user_profiles que consultasse user_profiles de novo).
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.user_profiles where id = auth.uid();
$$;

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
  area_id uuid references public.areas(id),
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.projects(folder_id);
create index on public.projects(area_id);

-- Fase 2c — usada nas políticas de todas as tabelas que dependem de um
-- projeto (direto ou via 1 salto, ex: schedule_task_resources -> task_id
-- -> schedule_tasks.project_id). Admin sempre passa; usuário comum só
-- passa se a área do projeto estiver entre as áreas atribuídas a ele.
create or replace function public.user_can_access_project(p_project_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid() and up.role = 'admin'
  )
  or exists (
    select 1 from public.projects p
    join public.user_areas ua on ua.area_id = p.area_id
    where p.id = p_project_id and ua.user_id = auth.uid()
  );
$$;

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
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
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
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
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
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
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
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
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
-- Fase 2d — Carimbo de quem criou/alterou cada registro
--
-- Roda como gatilho (não depende do app lembrar de enviar isso, e não dá
-- pra falsificar — auth.uid() vem do token, não de nada que o cliente
-- envie). created_by nunca muda depois de criado, mesmo que o update
-- tente sobrescrever.
-- ------------------------------------------------------------
create or replace function public.set_user_stamps()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  elsif TG_OP = 'UPDATE' then
    new.created_by := old.created_by;
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger stamp_projects before insert or update on public.projects for each row execute function public.set_user_stamps();
create trigger stamp_activities before insert or update on public.activities for each row execute function public.set_user_stamps();
create trigger stamp_versions before insert or update on public.versions for each row execute function public.set_user_stamps();
create trigger stamp_panel_items before insert or update on public.panel_items for each row execute function public.set_user_stamps();
create trigger stamp_schedule_tasks before insert or update on public.schedule_tasks for each row execute function public.set_user_stamps();

-- ------------------------------------------------------------
-- Fase 2e — Histórico completo de alterações
--
-- Diferente do carimbo (que só guarda o ÚLTIMO responsável), isso guarda
-- CADA criação/alteração/exclusão ao longo do tempo, com o "antes e
-- depois" de cada update. Só é gravado pelo gatilho (security definer) —
-- ninguém escreve direto nessa tabela pelo app.
-- ------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  user_id uuid references public.user_profiles(id) on delete set null,
  user_email text,
  changed_fields jsonb,
  created_at timestamptz not null default now()
);

create index on public.audit_log(table_name);
create index on public.audit_log(record_id);
create index on public.audit_log(created_at);

create or replace function public.log_audit_change()
returns trigger as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_record_id uuid;
  v_changed jsonb;
begin
  v_user_id := auth.uid();
  select email into v_user_email from public.user_profiles where id = v_user_id;

  if TG_OP = 'DELETE' then
    v_record_id := old.id;
    v_changed := to_jsonb(old);
  elsif TG_OP = 'UPDATE' then
    v_record_id := new.id;
    v_changed := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  else
    v_record_id := new.id;
    v_changed := to_jsonb(new);
  end if;

  insert into public.audit_log (table_name, record_id, action, user_id, user_email, changed_fields)
  values (TG_TABLE_NAME, v_record_id, lower(TG_OP), v_user_id, v_user_email, v_changed);

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger audit_projects after insert or update or delete on public.projects for each row execute function public.log_audit_change();
create trigger audit_activities after insert or update or delete on public.activities for each row execute function public.log_audit_change();
create trigger audit_versions after insert or update or delete on public.versions for each row execute function public.log_audit_change();
create trigger audit_panel_items after insert or update or delete on public.panel_items for each row execute function public.log_audit_change();
create trigger audit_schedule_tasks after insert or update or delete on public.schedule_tasks for each row execute function public.log_audit_change();

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
alter table public.areas enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_areas enable row level security;
alter table public.audit_log enable row level security;

create policy "logado - folders" on public.folders for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "area - projects" on public.projects for all
  using (auth.role() = 'authenticated' and (public.current_user_role() = 'admin' or area_id in (select area_id from public.user_areas where user_id = auth.uid())))
  with check (auth.role() = 'authenticated' and (public.current_user_role() = 'admin' or area_id in (select area_id from public.user_areas where user_id = auth.uid())));

create policy "area - kanban_columns" on public.kanban_columns for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - versions" on public.versions for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - activities" on public.activities for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - attachments" on public.attachments for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - panel_items" on public.panel_items for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - schedule_tasks" on public.schedule_tasks for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - schedule_dependencies" on public.schedule_dependencies for all
  using (auth.role() = 'authenticated' and public.user_can_access_project((select project_id from public.schedule_tasks where id = task_id)))
  with check (auth.role() = 'authenticated' and public.user_can_access_project((select project_id from public.schedule_tasks where id = task_id)));

create policy "logado - resources" on public.resources for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "area - schedule_task_resources" on public.schedule_task_resources for all
  using (auth.role() = 'authenticated' and public.user_can_access_project((select project_id from public.schedule_tasks where id = task_id)))
  with check (auth.role() = 'authenticated' and public.user_can_access_project((select project_id from public.schedule_tasks where id = task_id)));

create policy "logado - schedule_settings" on public.schedule_settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "logado - holidays" on public.holidays for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "area - version_pending_items" on public.version_pending_items for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - version_bumps" on public.version_bumps for all
  using (auth.role() = 'authenticated' and public.user_can_access_project(project_id))
  with check (auth.role() = 'authenticated' and public.user_can_access_project(project_id));

create policy "area - version_bump_items" on public.version_bump_items for all
  using (auth.role() = 'authenticated' and public.user_can_access_project((select project_id from public.version_bumps where id = version_bump_id)))
  with check (auth.role() = 'authenticated' and public.user_can_access_project((select project_id from public.version_bumps where id = version_bump_id)));

-- areas: todo logado pode ver (precisa pra dropdown/exibição); só admin
-- cria/edita/apaga.
create policy "ver areas" on public.areas for select using (auth.role() = 'authenticated');
create policy "admin gerencia areas" on public.areas for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- user_profiles: cada um vê o próprio perfil (pra saber o próprio papel);
-- só admin gerencia (inclusive não dá pra alguém promover a si mesmo —
-- só a policy de admin permite update, e ela exige já SER admin).
create policy "ver o próprio perfil" on public.user_profiles for select using (id = auth.uid());
create policy "admin gerencia perfis" on public.user_profiles for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- user_areas: cada um vê suas próprias áreas; só admin atribui/remove.
create policy "ver minhas areas" on public.user_areas for select using (user_id = auth.uid());
create policy "admin gerencia user_areas" on public.user_areas for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- audit_log: só admin lê; ninguém insere/atualiza/apaga direto pelo
-- app — só o gatilho grava, via security definer.
create policy "admin ve o historico" on public.audit_log for select using (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- Storage — bucket para anexos e arquivos do painel
--
-- ATENÇÃO: o bucket continua "public" (por compatibilidade — a leitura
-- hoje é feita com getPublicUrl, não signed URL). As políticas abaixo já
-- exigem login pra enviar/apagar arquivo pela API, mas um arquivo cuja URL
-- pública alguém já tenha continua acessível sem login, porque bucket
-- público serve o arquivo direto, sem passar pela política de "select"
-- daqui. Fechar esse último ponto exige trocar o bucket pra privado e as 3
-- telas que usam getPublicUrl (Atividades, Kanban, Painel) para signed URL
-- — deixei de fora dessa rodada por ser bem mais invasivo.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "leitura - attachments" on storage.objects for select using (bucket_id = 'attachments');
create policy "upload - attachments" on storage.objects for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
create policy "update - attachments" on storage.objects for update using (bucket_id = 'attachments' and auth.role() = 'authenticated');
create policy "delete - attachments" on storage.objects for delete using (bucket_id = 'attachments' and auth.role() = 'authenticated');