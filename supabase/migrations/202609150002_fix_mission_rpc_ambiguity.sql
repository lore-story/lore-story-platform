-- Korrigiert mehrdeutige PL/pgSQL-Ausgabespalten in den bereits ausgerollten Missions-RPCs.
begin;

create or replace function public.is_mission_teacher(p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.mission_sessions as ms where ms.id=is_mission_teacher.p_session and ms.teacher_id=auth.uid()) $$;

create or replace function public.is_active_mission_participant(p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.mission_participants as mp where mp.session_id=is_active_mission_participant.p_session and mp.auth_user_id=auth.uid() and mp.status<>'removed') $$;

create or replace function public.create_mission_session(p_loreboard_id uuid default null)
returns table(id uuid,story_slug text,title text,join_code text,status text,joining_open boolean,current_scene_id text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<create_mission_session>>
declare v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_raw bytea; v_code text; v_attempt int; v_created public.mission_sessions;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception using errcode='PT403',message='TEACHER_REQUIRED'; end if;
  if create_mission_session.p_loreboard_id is not null and not exists(select 1 from public.loreboards as lb where lb.id=create_mission_session.p_loreboard_id and lb.user_id=auth.uid()) then raise exception using errcode='PT403',message='LOREBOARD_FORBIDDEN'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||coalesce(create_mission_session.p_loreboard_id::text,'none')||'lore-astra-notruf-aus-dem-all',0));
  if exists(select 1 from public.mission_sessions as ms where ms.teacher_id=auth.uid() and ms.loreboard_id is not distinct from create_mission_session.p_loreboard_id and ms.story_slug='lore-astra-notruf-aus-dem-all' and ms.status<>'completed') then raise exception using errcode='PT409',message='OPEN_SESSION_EXISTS'; end if;
  for v_attempt in 1..8 loop
    v_raw:=extensions.gen_random_bytes(6); v_code:='';
    for v_index in 0..5 loop v_code:=v_code||pg_catalog.substr(v_alphabet,1+(pg_catalog.get_byte(v_raw,v_index)%pg_catalog.length(v_alphabet)),1); end loop;
    begin
      insert into public.mission_sessions as ms (teacher_id,loreboard_id,story_slug,title,join_code,current_scene_id,state)
      values(auth.uid(),create_mission_session.p_loreboard_id,'lore-astra-notruf-aus-dem-all','Notruf aus dem All',v_code,'testszene','{"stage":1}'::jsonb) returning ms.* into v_created;
      return query select v_created.id as id,v_created.story_slug as story_slug,v_created.title as title,v_created.join_code as join_code,v_created.status as status,v_created.joining_open as joining_open,v_created.current_scene_id as current_scene_id,v_created.created_at as created_at,v_created.started_at as started_at,v_created.completed_at as completed_at,v_created.updated_at as updated_at; return;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception using errcode='PT503',message='CODE_GENERATION_FAILED';
end $$;

create or replace function public.update_mission_session(p_session_id uuid,p_action text)
returns table(id uuid,story_slug text,title text,join_code text,status text,joining_open boolean,current_scene_id text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<update_mission_session>>
declare v_changed public.mission_sessions;
begin
  if not public.is_mission_teacher(update_mission_session.p_session_id) then raise exception using errcode='PT403',message='MISSION_FORBIDDEN'; end if;
  if exists(select 1 from public.mission_sessions as ms where ms.id=update_mission_session.p_session_id and ms.status='completed') then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
  update public.mission_sessions as ms set
    joining_open=case when update_mission_session.p_action='open_joining' then true when update_mission_session.p_action in ('close_joining','start','complete') then false else ms.joining_open end,
    status=case when update_mission_session.p_action='start' then 'active' when update_mission_session.p_action='pause' then 'paused' when update_mission_session.p_action='resume' then 'active' when update_mission_session.p_action='complete' then 'completed' else ms.status end,
    started_at=case when update_mission_session.p_action='start' then coalesce(ms.started_at,pg_catalog.now()) else ms.started_at end,
    completed_at=case when update_mission_session.p_action='complete' then pg_catalog.now() else ms.completed_at end
  where ms.id=update_mission_session.p_session_id and update_mission_session.p_action in ('open_joining','close_joining','start','pause','resume','complete') returning ms.* into v_changed;
  if not found then raise exception using errcode='PT400',message='INVALID_ACTION'; end if;
  return query select v_changed.id as id,v_changed.story_slug as story_slug,v_changed.title as title,v_changed.join_code as join_code,v_changed.status as status,v_changed.joining_open as joining_open,v_changed.current_scene_id as current_scene_id,v_changed.created_at as created_at,v_changed.started_at as started_at,v_changed.completed_at as completed_at,v_changed.updated_at as updated_at;
end $$;

create or replace function public.remove_mission_participant(p_participant_id uuid) returns void
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<remove_mission_participant>>
begin
 update public.mission_participants as mp set status='removed',removed_at=pg_catalog.now(),ready_scene_id=null
 where mp.id=remove_mission_participant.p_participant_id and mp.status<>'removed' and public.is_mission_teacher(mp.session_id)
 and exists(select 1 from public.mission_sessions as ms where ms.id=mp.session_id and ms.status<>'completed');
 if not found then raise exception using errcode='PT403',message='PARTICIPANT_REMOVE_FORBIDDEN'; end if;
end $$;

create or replace function public.inspect_mission(p_code text)
returns table(session_id uuid,participant_id uuid,title text,status text,joining_open boolean,callsigns text[],taken_callsigns text[],participant_status text,callsign text,current_scene_id text,ready_scene_id text)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<inspect_mission>>
declare v_session public.mission_sessions; v_participant public.mission_participants; v_participant_found boolean;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then raise exception using errcode='PT401',message='ANONYMOUS_AUTH_REQUIRED'; end if;
 select ms.* into v_session from public.mission_sessions as ms where ms.join_code=pg_catalog.upper(pg_catalog.btrim(inspect_mission.p_code));
 if not found then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 select mp.* into v_participant from public.mission_participants as mp where mp.session_id=v_session.id and mp.auth_user_id=auth.uid();
 v_participant_found := found;
 if v_participant_found and v_participant.status='removed' then
   return query select v_session.id as session_id,v_participant.id as participant_id,v_session.title as title,v_session.status as status,false as joining_open,public.mission_callsigns() as callsigns,'{}'::text[] as taken_callsigns,v_participant.status as participant_status,v_participant.callsign as callsign,v_session.current_scene_id as current_scene_id,v_participant.ready_scene_id as ready_scene_id; return;
 end if;
 if v_session.status='completed' and not v_participant_found then raise exception using errcode='PT410',message='MISSION_COMPLETED'; end if;
 return query select v_session.id as session_id,v_participant.id as participant_id,v_session.title as title,v_session.status as status,v_session.joining_open as joining_open,public.mission_callsigns() as callsigns,
   coalesce((select pg_catalog.array_agg(mp.callsign order by mp.callsign) from public.mission_participants as mp where mp.session_id=v_session.id and mp.status<>'removed'),'{}'::text[]) as taken_callsigns,
   v_participant.status as participant_status,v_participant.callsign as callsign,v_session.current_scene_id as current_scene_id,v_participant.ready_scene_id as ready_scene_id;
end $$;

create or replace function public.join_mission(p_code text,p_callsign text)
returns table(session_id uuid,participant_id uuid,title text,status text,joining_open boolean,current_scene_id text,callsign text,ready_scene_id text)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<join_mission>>
declare v_session public.mission_sessions; v_participant public.mission_participants; v_participant_found boolean;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then raise exception using errcode='PT401',message='ANONYMOUS_AUTH_REQUIRED'; end if;
 select ms.* into v_session from public.mission_sessions as ms where ms.join_code=pg_catalog.upper(pg_catalog.btrim(join_mission.p_code)) for update;
 if not found then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 select mp.* into v_participant from public.mission_participants as mp where mp.session_id=v_session.id and mp.auth_user_id=auth.uid();
 v_participant_found := found;
 if v_participant_found and v_participant.status='removed' then raise exception using errcode='PT403',message='PARTICIPANT_REMOVED'; end if;
 if v_session.status='completed' then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 if v_participant_found then
   update public.mission_participants as mp set status='connected',last_seen_at=pg_catalog.now() where mp.id=v_participant.id returning mp.* into v_participant;
 else
   if not v_session.joining_open then raise exception using errcode='PT403',message='JOINING_CLOSED'; end if;
   if not (pg_catalog.btrim(join_mission.p_callsign)=any(public.mission_callsigns())) then raise exception using errcode='PT400',message='INVALID_CALLSIGN'; end if;
   begin insert into public.mission_participants as mp (session_id,auth_user_id,callsign) values(v_session.id,auth.uid(),pg_catalog.btrim(join_mission.p_callsign)) returning mp.* into v_participant;
   exception when unique_violation then raise exception using errcode='23505',message='CALLSIGN_TAKEN'; end;
 end if;
 return query select v_session.id as session_id,v_participant.id as participant_id,v_session.title as title,v_session.status as status,v_session.joining_open as joining_open,v_session.current_scene_id as current_scene_id,v_participant.callsign as callsign,v_participant.ready_scene_id as ready_scene_id;
end $$;

create or replace function public.update_my_mission_presence(p_session_id uuid,p_connected boolean,p_ready boolean default null) returns void
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<update_my_mission_presence>>
declare v_scene text; v_mission_status text;
begin
 select ms.current_scene_id,ms.status into v_scene,v_mission_status from public.mission_sessions as ms where ms.id=update_my_mission_presence.p_session_id;
 if not found then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 if v_mission_status='completed' then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 update public.mission_participants as mp set status=case when update_my_mission_presence.p_connected then 'connected' else 'disconnected' end,last_seen_at=pg_catalog.now(),
 ready_scene_id=case when update_my_mission_presence.p_ready is null then mp.ready_scene_id when update_my_mission_presence.p_ready then v_scene else null end
 where mp.session_id=update_my_mission_presence.p_session_id and mp.auth_user_id=auth.uid() and mp.status<>'removed';
 if not found then raise exception using errcode='PT403',message='PARTICIPANT_REMOVED'; end if;
end $$;

revoke all on function public.is_mission_teacher(uuid),public.is_active_mission_participant(uuid),public.create_mission_session(uuid),public.update_mission_session(uuid,text),public.remove_mission_participant(uuid),public.inspect_mission(text),public.join_mission(text,text),public.update_my_mission_presence(uuid,boolean,boolean) from public,anon;
grant execute on function public.is_mission_teacher(uuid),public.is_active_mission_participant(uuid),public.create_mission_session(uuid),public.update_mission_session(uuid,text),public.remove_mission_participant(uuid),public.inspect_mission(text),public.join_mission(text,text),public.update_my_mission_presence(uuid,boolean,boolean) to authenticated;
commit;
