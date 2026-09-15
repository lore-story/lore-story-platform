-- Storymodus Stufe 1. Nach der Loreboard-Basismigration als eine Transaktion ausführen.
begin;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_mission_updated_at() returns trigger language plpgsql
set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
revoke all on function public.set_mission_updated_at() from public, anon, authenticated;

create table public.mission_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  loreboard_id uuid references public.loreboards(id) on delete set null,
  story_slug text not null,
  title text not null,
  join_code text not null unique,
  status text not null default 'lobby' check (status in ('lobby','active','paused','completed')),
  joining_open boolean not null default true,
  current_scene_id text,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status <> 'completed') or completed_at is not null)
);
create table public.mission_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mission_sessions(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  callsign text not null,
  status text not null default 'connected' check (status in ('connected','disconnected','removed')),
  ready_scene_id text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  unique(session_id, auth_user_id),
  check ((status <> 'removed') or removed_at is not null)
);
create unique index mission_participants_active_callsign on public.mission_participants(session_id, lower(callsign)) where status <> 'removed';
create unique index mission_one_open_run_per_board on public.mission_sessions(teacher_id, loreboard_id, story_slug) where status <> 'completed' and loreboard_id is not null;
create index mission_sessions_teacher_status on public.mission_sessions(teacher_id,status,updated_at desc);
create index mission_sessions_join_code on public.mission_sessions(join_code);
create index mission_participants_session_status on public.mission_participants(session_id,status);
create index mission_participants_auth_user on public.mission_participants(auth_user_id,session_id);
create trigger mission_sessions_updated_at before update on public.mission_sessions for each row execute function public.set_mission_updated_at();

alter table public.mission_sessions enable row level security;
alter table public.mission_participants enable row level security;

create or replace function public.is_mission_teacher(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.mission_sessions where id=p_session and teacher_id=auth.uid()) $$;
create or replace function public.is_active_mission_participant(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.mission_participants where session_id=p_session and auth_user_id=auth.uid() and status<>'removed') $$;
revoke all on function public.is_mission_teacher(uuid), public.is_active_mission_participant(uuid) from public,anon,authenticated;
grant execute on function public.is_mission_teacher(uuid), public.is_active_mission_participant(uuid) to authenticated;

create policy teacher_session_select on public.mission_sessions for select to authenticated using (teacher_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy participant_session_select on public.mission_sessions for select to authenticated using (public.is_active_mission_participant(id));
create policy teacher_participants_select on public.mission_participants for select to authenticated using (public.is_mission_teacher(session_id));
-- Die entfernte eigene Zeile bleibt lesbar, damit Realtime und Reload die Entfernung zuverlässig zeigen.
create policy own_participant_select on public.mission_participants for select to authenticated using (auth_user_id=auth.uid());

revoke all on public.mission_sessions, public.mission_participants from public,anon,authenticated;
grant select(id,story_slug,title,join_code,status,joining_open,current_scene_id,created_at,started_at,completed_at,updated_at) on public.mission_sessions to authenticated;
grant select(id,session_id,callsign,status,ready_scene_id,joined_at,last_seen_at,removed_at) on public.mission_participants to authenticated;

create or replace function public.mission_callsigns() returns text[] language sql immutable set search_path='' as $$
 select array['Astrofuchs','Blitzbär','Cosmo','Dämmerfalke','Echowolf','Flinkstern','Funkelfisch','Galaxie','Himmelsluchs','Ionenigel','Komet','Lichtlöwe','Meteor','Mondmotte','Nebelpanda','Nova','Orbit','Polarstern','Quasar','Rakete','Saturn','Sirius','Solaris','Sternenhirsch','Sternenkatze','Supernova','Titan','Umlauf','Vega','Weltraumwal']::text[] $$;
revoke all on function public.mission_callsigns() from public,anon;
grant execute on function public.mission_callsigns() to authenticated;

create or replace function public.create_mission_session(p_loreboard_id uuid default null)
returns table(id uuid,story_slug text,title text,join_code text,status text,joining_open boolean,current_scene_id text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; raw bytea; code text; attempt int; created public.mission_sessions;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception using errcode='PT403',message='TEACHER_REQUIRED'; end if;
  if p_loreboard_id is not null and not exists(select 1 from public.loreboards where loreboards.id=p_loreboard_id and user_id=auth.uid()) then raise exception using errcode='PT403',message='LOREBOARD_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||coalesce(p_loreboard_id::text,'none')||'lore-astra-notruf-aus-dem-all',0));
  if exists(select 1 from public.mission_sessions s where s.teacher_id=auth.uid() and s.loreboard_id is not distinct from p_loreboard_id and s.story_slug='lore-astra-notruf-aus-dem-all' and s.status<>'completed') then raise exception using errcode='PT409',message='OPEN_SESSION_EXISTS'; end if;
  for attempt in 1..8 loop
    raw:=extensions.gen_random_bytes(6); code:='';
    for i in 0..5 loop code:=code||substr(alphabet,1+(get_byte(raw,i)%length(alphabet)),1); end loop;
    begin
      insert into public.mission_sessions(teacher_id,loreboard_id,story_slug,title,join_code,current_scene_id,state)
      values(auth.uid(),p_loreboard_id,'lore-astra-notruf-aus-dem-all','Notruf aus dem All',code,'testszene','{"stage":1}'::jsonb) returning * into created;
      return query select created.id,created.story_slug,created.title,created.join_code,created.status,created.joining_open,created.current_scene_id,created.created_at,created.started_at,created.completed_at,created.updated_at; return;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception using errcode='PT503',message='CODE_GENERATION_FAILED';
end $$;

create or replace function public.update_mission_session(p_session_id uuid,p_action text)
returns table(id uuid,story_slug text,title text,join_code text,status text,joining_open boolean,current_scene_id text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare changed public.mission_sessions;
begin
  if not public.is_mission_teacher(p_session_id) then raise exception using errcode='PT403',message='MISSION_FORBIDDEN'; end if;
  if exists(select 1 from public.mission_sessions where mission_sessions.id=p_session_id and mission_sessions.status='completed') then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
  update public.mission_sessions set
    joining_open=case when p_action='open_joining' then true when p_action in ('close_joining','start','complete') then false else joining_open end,
    status=case when p_action='start' then 'active' when p_action='pause' then 'paused' when p_action='resume' then 'active' when p_action='complete' then 'completed' else status end,
    started_at=case when p_action='start' then coalesce(started_at,now()) else started_at end,
    completed_at=case when p_action='complete' then now() else completed_at end
  where mission_sessions.id=p_session_id and p_action in ('open_joining','close_joining','start','pause','resume','complete') returning * into changed;
  if not found then raise exception using errcode='PT400',message='INVALID_ACTION'; end if;
  return query select changed.id,changed.story_slug,changed.title,changed.join_code,changed.status,changed.joining_open,changed.current_scene_id,changed.created_at,changed.started_at,changed.completed_at,changed.updated_at;
end $$;

create or replace function public.remove_mission_participant(p_participant_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.mission_participants p set status='removed',removed_at=now(),ready_scene_id=null
 where p.id=p_participant_id and p.status<>'removed' and public.is_mission_teacher(p.session_id)
 and exists(select 1 from public.mission_sessions s where s.id=p.session_id and s.status<>'completed');
 if not found then raise exception using errcode='PT403',message='PARTICIPANT_REMOVE_FORBIDDEN'; end if;
end $$;

create or replace function public.inspect_mission(p_code text)
returns table(session_id uuid,participant_id uuid,title text,status text,joining_open boolean,callsigns text[],taken_callsigns text[],participant_status text,callsign text,current_scene_id text,ready_scene_id text)
language plpgsql security definer set search_path='' as $$
declare s public.mission_sessions; p public.mission_participants;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then raise exception using errcode='PT401',message='ANONYMOUS_AUTH_REQUIRED'; end if;
 select * into s from public.mission_sessions where join_code=upper(trim(p_code));
 if not found then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 select * into p from public.mission_participants where session_id=s.id and auth_user_id=auth.uid();
 if found and p.status='removed' then
   return query select s.id,p.id,s.title,s.status,false,public.mission_callsigns(),'{}'::text[],p.status,p.callsign,s.current_scene_id,p.ready_scene_id; return;
 end if;
 if s.status='completed' and not found then raise exception using errcode='PT410',message='MISSION_COMPLETED'; end if;
 return query select s.id,p.id,s.title,s.status,s.joining_open,public.mission_callsigns(),
   coalesce((select array_agg(x.callsign order by x.callsign) from public.mission_participants x where x.session_id=s.id and x.status<>'removed'),'{}'),
   p.status,p.callsign,s.current_scene_id,p.ready_scene_id;
end $$;

create or replace function public.join_mission(p_code text,p_callsign text)
returns table(session_id uuid,participant_id uuid,title text,status text,joining_open boolean,current_scene_id text,callsign text,ready_scene_id text)
language plpgsql security definer set search_path='' as $$
declare s public.mission_sessions; p public.mission_participants;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then raise exception using errcode='PT401',message='ANONYMOUS_AUTH_REQUIRED'; end if;
 select * into s from public.mission_sessions where join_code=upper(trim(p_code)) for update;
 if not found then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 select * into p from public.mission_participants where session_id=s.id and auth_user_id=auth.uid();
 if found and p.status='removed' then raise exception using errcode='PT403',message='PARTICIPANT_REMOVED'; end if;
 if s.status='completed' then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 if found then
   update public.mission_participants set status='connected',last_seen_at=now() where mission_participants.id=p.id returning * into p;
 else
   if not s.joining_open then raise exception using errcode='PT403',message='JOINING_CLOSED'; end if;
   if not (trim(p_callsign)=any(public.mission_callsigns())) then raise exception using errcode='PT400',message='INVALID_CALLSIGN'; end if;
   begin insert into public.mission_participants(session_id,auth_user_id,callsign) values(s.id,auth.uid(),trim(p_callsign)) returning * into p;
   exception when unique_violation then raise exception using errcode='23505',message='CALLSIGN_TAKEN'; end;
 end if;
 return query select s.id,p.id,s.title,s.status,s.joining_open,s.current_scene_id,p.callsign,p.ready_scene_id;
end $$;

create or replace function public.update_my_mission_presence(p_session_id uuid,p_connected boolean,p_ready boolean default null) returns void
language plpgsql security definer set search_path='' as $$
declare scene text; mission_status text;
begin
 select current_scene_id,status into scene,mission_status from public.mission_sessions where id=p_session_id;
 if not found then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 if mission_status='completed' then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 update public.mission_participants set status=case when p_connected then 'connected' else 'disconnected' end,last_seen_at=now(),
 ready_scene_id=case when p_ready is null then ready_scene_id when p_ready then scene else null end
 where session_id=p_session_id and auth_user_id=auth.uid() and status<>'removed';
 if not found then raise exception using errcode='PT403',message='PARTICIPANT_REMOVED'; end if;
end $$;

revoke all on function public.create_mission_session(uuid),public.update_mission_session(uuid,text),public.remove_mission_participant(uuid),public.inspect_mission(text),public.join_mission(text,text),public.update_my_mission_presence(uuid,boolean,boolean) from public,anon;
grant execute on function public.create_mission_session(uuid),public.update_mission_session(uuid,text),public.remove_mission_participant(uuid),public.inspect_mission(text),public.join_mission(text,text),public.update_my_mission_presence(uuid,boolean,boolean) to authenticated;

-- Restriktive Policies werden mit allen bestehenden permissiven Policies per AND verknüpft.
drop policy if exists loreboards_confirmed_teacher_insert on public.loreboards;
drop policy if exists loreboards_confirmed_teacher_update on public.loreboards;
create policy loreboards_confirmed_teacher_insert on public.loreboards as restrictive for insert to authenticated
 with check (user_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy loreboards_confirmed_teacher_update on public.loreboards as restrictive for update to authenticated
 using (user_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false)
 with check (user_id=auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mission_sessions') then alter publication supabase_realtime add table public.mission_sessions; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mission_participants') then alter publication supabase_realtime add table public.mission_participants; end if;
end $$;
commit;
