-- Storymodus Stufe 1. Nach der Loreboard-Migration im Supabase SQL Editor ausführen.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at() returns trigger language plpgsql
set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.generate_mission_join_code() returns text
language plpgsql security definer set search_path = '' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; raw bytea := extensions.gen_random_bytes(6); candidate text := ''; i int;
begin
  for i in 0..5 loop candidate := candidate || substr(alphabet, 1 + (get_byte(raw,i) % length(alphabet)), 1); end loop;
  return candidate;
end $$;
revoke all on function public.generate_mission_join_code() from public, anon, authenticated;

create table public.mission_sessions (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references auth.users(id) on delete cascade,
 loreboard_id uuid references public.loreboards(id) on delete set null,
 story_slug text not null default 'lore-astra-notruf-aus-dem-all', title text not null default 'Notruf aus dem All',
 join_code text not null unique default public.generate_mission_join_code(),
 status text not null default 'lobby' check (status in ('lobby','active','paused','completed')),
 joining_open boolean not null default true, current_scene_id text default 'testszene', state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, updated_at timestamptz not null default now(),
 check ((status <> 'completed') or completed_at is not null)
);
create table public.mission_participants (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.mission_sessions(id) on delete cascade,
 auth_user_id uuid not null references auth.users(id) on delete cascade, callsign text not null,
 status text not null default 'connected' check (status in ('connected','disconnected','removed')),
 ready_scene_id text, joined_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), removed_at timestamptz,
 unique(session_id, auth_user_id), check ((status <> 'removed') or removed_at is not null)
);
create unique index mission_participants_active_callsign on public.mission_participants(session_id, lower(callsign)) where status <> 'removed';
create index mission_sessions_teacher_status on public.mission_sessions(teacher_id,status,updated_at desc);
create index mission_sessions_join_code on public.mission_sessions(join_code);
create index mission_participants_session_status on public.mission_participants(session_id,status);
create index mission_participants_auth_user on public.mission_participants(auth_user_id,session_id);
create trigger mission_sessions_updated_at before update on public.mission_sessions for each row execute function public.set_updated_at();

alter table public.mission_sessions enable row level security;
alter table public.mission_participants enable row level security;

create or replace function public.is_mission_teacher(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.mission_sessions where id=p_session and teacher_id=auth.uid()) $$;
create or replace function public.is_mission_participant(p_session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.mission_participants where session_id=p_session and auth_user_id=auth.uid() and status<>'removed') $$;
revoke all on function public.is_mission_teacher(uuid),public.is_mission_participant(uuid) from public,anon,authenticated;
grant execute on function public.is_mission_teacher(uuid),public.is_mission_participant(uuid) to authenticated;

create policy teacher_session_select on public.mission_sessions for select to authenticated using (teacher_id = auth.uid());
create policy teacher_session_insert on public.mission_sessions for insert to authenticated with check (teacher_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false);
create policy teacher_session_update on public.mission_sessions for update to authenticated using (teacher_id=auth.uid() and status <> 'completed') with check (teacher_id=auth.uid());
create policy participant_own_session_select on public.mission_sessions for select to authenticated using (
 public.is_mission_participant(id));
create policy teacher_participants_select on public.mission_participants for select to authenticated using (
 public.is_mission_teacher(session_id));
create policy own_participant_select on public.mission_participants for select to authenticated using (auth_user_id=auth.uid() and status <> 'removed');
-- Status-/Bereitschaftsänderungen laufen absichtlich nur über die eingeschränkten RPCs.
create policy teacher_participants_update on public.mission_participants for update to authenticated using (
 public.is_mission_teacher(session_id)) with check (
 public.is_mission_teacher(session_id));

revoke all on public.mission_sessions, public.mission_participants from anon, authenticated;
grant insert,update on public.mission_sessions to authenticated;
grant select(id,story_slug,title,join_code,status,joining_open,current_scene_id,created_at,started_at,completed_at,updated_at) on public.mission_sessions to authenticated;
grant select,update on public.mission_participants to authenticated;

create or replace function public.mission_callsigns() returns text[] language sql immutable set search_path='' as $$
 select array['Astrofuchs','Blitzbär','Cosmo','Dämmerfalke','Echowolf','Flinkstern','Funkelfisch','Galaxie','Himmelsluchs','Ionenigel','Komet','Lichtlöwe','Meteor','Mondmotte','Nebelpanda','Nova','Orbit','Polarstern','Quasar','Rakete','Saturn','Sirius','Solaris','Sternenhirsch','Sternenkatze','Supernova','Titan','Umlauf','Vega','Weltraumwal']::text[] $$;
revoke all on function public.mission_callsigns() from public;
grant execute on function public.mission_callsigns() to authenticated;

create or replace function public.inspect_mission(p_code text) returns table(session_id uuid,title text,status text,joining_open boolean,callsigns text[],taken_callsigns text[])
language plpgsql security definer set search_path='' as $$
declare s public.mission_sessions;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then raise exception using errcode='PT401',message='ANONYMOUS_AUTH_REQUIRED'; end if;
 select * into s from public.mission_sessions where join_code=upper(trim(p_code));
 if not found or s.status='completed' then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 return query select s.id,s.title,s.status,s.joining_open,public.mission_callsigns(),coalesce(array_agg(p.callsign order by p.callsign) filter(where p.status<>'removed'),'{}')
 from public.mission_participants p where p.session_id=s.id;
end $$;

create or replace function public.join_mission(p_code text,p_callsign text) returns table(session_id uuid,participant_id uuid,title text,status text,joining_open boolean,current_scene_id text,callsign text,ready_scene_id text)
language plpgsql security definer set search_path='' as $$
declare s public.mission_sessions; p public.mission_participants;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then raise exception using errcode='PT401',message='ANONYMOUS_AUTH_REQUIRED'; end if;
 select * into s from public.mission_sessions where join_code=upper(trim(p_code)) for update;
 if not found or s.status='completed' then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 select * into p from public.mission_participants where mission_participants.session_id=s.id and auth_user_id=auth.uid();
 if found then
   if p.status='removed' then raise exception using errcode='PT403',message='PARTICIPANT_REMOVED'; end if;
   update public.mission_participants set status='connected',last_seen_at=now() where id=p.id returning * into p;
 else
   if not s.joining_open then raise exception using errcode='PT403',message='JOINING_CLOSED'; end if;
   if not (trim(p_callsign)=any(public.mission_callsigns())) then raise exception using errcode='PT400',message='INVALID_CALLSIGN'; end if;
   if exists(select 1 from public.mission_participants x where x.session_id=s.id and lower(x.callsign)=lower(trim(p_callsign)) and x.status<>'removed') then raise exception using errcode='23505',message='CALLSIGN_TAKEN'; end if;
   begin insert into public.mission_participants(session_id,auth_user_id,callsign) values(s.id,auth.uid(),trim(p_callsign)) returning * into p;
   exception when unique_violation then raise exception using errcode='23505',message='CALLSIGN_TAKEN'; end;
 end if;
 return query select s.id,p.id,s.title,s.status,s.joining_open,s.current_scene_id,p.callsign,p.ready_scene_id;
end $$;

create or replace function public.update_my_mission_presence(p_session_id uuid,p_connected boolean,p_ready boolean default null) returns void
language plpgsql security definer set search_path='' as $$
declare scene text;
begin
 select current_scene_id into scene from public.mission_sessions where id=p_session_id and status<>'completed';
 update public.mission_participants set status=case when p_connected then 'connected' else 'disconnected' end,last_seen_at=now(),
 ready_scene_id=case when p_ready is null then ready_scene_id when p_ready then scene else null end
 where session_id=p_session_id and auth_user_id=auth.uid() and status<>'removed';
 if not found then raise exception using errcode='PT403',message='PARTICIPANT_REMOVED'; end if;
end $$;
revoke all on function public.inspect_mission(text),public.join_mission(text,text),public.update_my_mission_presence(uuid,boolean,boolean) from public,anon;
grant execute on function public.inspect_mission(text),public.join_mission(text,text),public.update_my_mission_presence(uuid,boolean,boolean) to authenticated;

-- Idempotent publication setup for Supabase Realtime; Realtime applies table RLS to subscribers.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mission_sessions') then alter publication supabase_realtime add table public.mission_sessions; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mission_participants') then alter publication supabase_realtime add table public.mission_participants; end if;
end $$;
