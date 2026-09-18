-- Lore-Werkstatt, Stufe 1. Apply manually through the Supabase SQL editor/CLI
-- after reviewing on a staging project. This migration does not publish projects.
create table if not exists public.mission_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  status text not null default 'draft' check (status in ('draft','review','published')),
  audience_level text not null check (audience_level in ('class-1-2','class-3-6','class-7-12','custom')),
  availability_type text not null default 'free' check (availability_type in ('free','world')),
  world_id text,
  subject text check (subject is null or char_length(subject) <= 100),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 600),
  schema_version integer not null default 1 check (schema_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_projects_world_assignment check (
    (availability_type='free' and world_id is null) or
    (availability_type='world' and world_id is not null and char_length(btrim(world_id)) > 0)
  )
);

create table if not exists public.mission_scenes (
  id uuid primary key default gen_random_uuid(),
  mission_project_id uuid not null references public.mission_projects(id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  scene_type text not null check (scene_type in ('narrative','assignment','transition')),
  layout_template text not null check (layout_template in ('text','media','split')),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mission_project_id,position)
);

create index if not exists mission_projects_owner_updated_idx on public.mission_projects(owner_id,updated_at desc);
create index if not exists mission_scenes_project_idx on public.mission_scenes(mission_project_id);

create or replace function public.touch_workshop_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists mission_projects_touch_updated_at on public.mission_projects;
create trigger mission_projects_touch_updated_at before update on public.mission_projects for each row execute function public.touch_workshop_updated_at();
drop trigger if exists mission_scenes_touch_updated_at on public.mission_scenes;
create trigger mission_scenes_touch_updated_at before update on public.mission_scenes for each row execute function public.touch_workshop_updated_at();

alter table public.mission_projects enable row level security;
alter table public.mission_scenes enable row level security;

drop policy if exists workshop_owner_projects_select on public.mission_projects;
create policy workshop_owner_projects_select on public.mission_projects for select to authenticated
  using (owner_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
drop policy if exists workshop_owner_projects_insert on public.mission_projects;
create policy workshop_owner_projects_insert on public.mission_projects for insert to authenticated
  with check (owner_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
drop policy if exists workshop_owner_projects_update on public.mission_projects;
create policy workshop_owner_projects_update on public.mission_projects for update to authenticated
  using (owner_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false)
  with check (owner_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
drop policy if exists workshop_owner_projects_delete on public.mission_projects;
create policy workshop_owner_projects_delete on public.mission_projects for delete to authenticated
  using (owner_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);

drop policy if exists workshop_owner_scenes_select on public.mission_scenes;
create policy workshop_owner_scenes_select on public.mission_scenes for select to authenticated using (exists (
  select 1 from public.mission_projects project where project.id=mission_project_id and project.owner_id=auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false));
drop policy if exists workshop_owner_scenes_insert on public.mission_scenes;
create policy workshop_owner_scenes_insert on public.mission_scenes for insert to authenticated with check (exists (
  select 1 from public.mission_projects project where project.id=mission_project_id and project.owner_id=auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false));
drop policy if exists workshop_owner_scenes_update on public.mission_scenes;
create policy workshop_owner_scenes_update on public.mission_scenes for update to authenticated using (exists (
  select 1 from public.mission_projects project where project.id=mission_project_id and project.owner_id=auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false)) with check (exists (
  select 1 from public.mission_projects project where project.id=mission_project_id and project.owner_id=auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false));
drop policy if exists workshop_owner_scenes_delete on public.mission_scenes;
create policy workshop_owner_scenes_delete on public.mission_scenes for delete to authenticated using (exists (
  select 1 from public.mission_projects project where project.id=mission_project_id and project.owner_id=auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false));

revoke all on public.mission_projects, public.mission_scenes from anon;
grant select,insert,update,delete on public.mission_projects, public.mission_scenes to authenticated;
