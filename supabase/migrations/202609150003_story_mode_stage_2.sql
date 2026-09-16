-- Storymodus Stufe 2: additive Astra-Szenensteuerung und szenengebundene Bereitschaft.
begin;

create or replace function public.astra_scene_ids() returns text[]
language sql immutable set search_path='' as $$
  select array['ankunft','erinnerungssignal','crew-check','navigation','missionsarchiv','ausruestung','sicherheitscheck','startfreigabe']::text[]
$$;
revoke all on function public.astra_scene_ids() from public,anon;
grant execute on function public.astra_scene_ids() to authenticated;

-- Neue Sitzungen beginnen immer in Szene 1. Bestehende offene Stufe-1-Sitzungen werden sicher fortgeführt.
update public.mission_sessions as ms set current_scene_id='ankunft', state=ms.state||'{"stage":2}'::jsonb
where ms.story_slug='lore-astra-notruf-aus-dem-all' and ms.status<>'completed' and (ms.current_scene_id is null or ms.current_scene_id='testszene');

create or replace function public.create_mission_session(p_loreboard_id uuid default null)
returns table(id uuid,story_slug text,title text,join_code text,status text,joining_open boolean,current_scene_id text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<create_mission_session>>
declare v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_raw bytea; v_code text; v_attempt int; v_index int; v_created public.mission_sessions;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception using errcode='PT403',message='TEACHER_REQUIRED'; end if;
 if create_mission_session.p_loreboard_id is not null and not exists(select 1 from public.loreboards as lb where lb.id=create_mission_session.p_loreboard_id and lb.user_id=auth.uid()) then raise exception using errcode='PT403',message='LOREBOARD_FORBIDDEN'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||coalesce(create_mission_session.p_loreboard_id::text,'none')||'lore-astra-notruf-aus-dem-all',0));
 if exists(select 1 from public.mission_sessions as ms where ms.teacher_id=auth.uid() and ms.loreboard_id is not distinct from create_mission_session.p_loreboard_id and ms.story_slug='lore-astra-notruf-aus-dem-all' and ms.status<>'completed') then raise exception using errcode='PT409',message='OPEN_SESSION_EXISTS'; end if;
 for v_attempt in 1..8 loop
  v_raw:=extensions.gen_random_bytes(6); v_code:='';
  for v_index in 0..5 loop v_code:=v_code||pg_catalog.substr(v_alphabet,1+(pg_catalog.get_byte(v_raw,v_index)%pg_catalog.length(v_alphabet)),1); end loop;
  begin
   insert into public.mission_sessions as ms(teacher_id,loreboard_id,story_slug,title,join_code,current_scene_id,state) values(auth.uid(),create_mission_session.p_loreboard_id,'lore-astra-notruf-aus-dem-all','Notruf aus dem All',v_code,'ankunft','{"stage":2}'::jsonb) returning ms.* into v_created;
   return query select v_created.id,v_created.story_slug,v_created.title,v_created.join_code,v_created.status,v_created.joining_open,v_created.current_scene_id,v_created.created_at,v_created.started_at,v_created.completed_at,v_created.updated_at; return;
  exception when unique_violation then null; end;
 end loop;
 raise exception using errcode='PT503',message='CODE_GENERATION_FAILED';
end $$;

create or replace function public.set_mission_scene(p_session_id uuid,p_scene_id text)
returns table(id uuid,story_slug text,title text,join_code text,status text,joining_open boolean,current_scene_id text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<set_mission_scene>>
declare v_changed public.mission_sessions;
begin
 if not public.is_mission_teacher(set_mission_scene.p_session_id) then raise exception using errcode='PT403',message='MISSION_FORBIDDEN'; end if;
 if not (set_mission_scene.p_scene_id=any(public.astra_scene_ids())) then raise exception using errcode='PT400',message='INVALID_SCENE'; end if;
 update public.mission_sessions as ms set current_scene_id=set_mission_scene.p_scene_id
 where ms.id=set_mission_scene.p_session_id and ms.status in ('active','paused') returning ms.* into v_changed;
 if not found then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 return query select v_changed.id,v_changed.story_slug,v_changed.title,v_changed.join_code,v_changed.status,v_changed.joining_open,v_changed.current_scene_id,v_changed.created_at,v_changed.started_at,v_changed.completed_at,v_changed.updated_at;
end $$;

create or replace function public.navigate_mission_scene(p_session_id uuid,p_direction integer)
returns table(id uuid,story_slug text,title text,join_code text,status text,joining_open boolean,current_scene_id text,created_at timestamptz,started_at timestamptz,completed_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<navigate_mission_scene>>
declare v_current text; v_position integer; v_target text;
begin
 if navigate_mission_scene.p_direction not in (-1,1) then raise exception using errcode='PT400',message='INVALID_DIRECTION'; end if;
 if not public.is_mission_teacher(navigate_mission_scene.p_session_id) then raise exception using errcode='PT403',message='MISSION_FORBIDDEN'; end if;
 select ms.current_scene_id into v_current from public.mission_sessions as ms where ms.id=navigate_mission_scene.p_session_id and ms.status in ('active','paused') for update;
 if not found then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 v_position:=pg_catalog.array_position(public.astra_scene_ids(),v_current); v_target:=(public.astra_scene_ids())[pg_catalog.greatest(1,pg_catalog.least(8,v_position+navigate_mission_scene.p_direction))];
 return query select * from public.set_mission_scene(navigate_mission_scene.p_session_id,v_target);
end $$;

create or replace function public.reset_mission_readiness(p_session_id uuid,p_scene_id text) returns void
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<reset_mission_readiness>>
begin
 if not public.is_mission_teacher(reset_mission_readiness.p_session_id) then raise exception using errcode='PT403',message='MISSION_FORBIDDEN'; end if;
 if exists(select 1 from public.mission_sessions as ms where ms.id=reset_mission_readiness.p_session_id and ms.status='completed') then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 update public.mission_participants as mp set ready_scene_id=null where mp.session_id=reset_mission_readiness.p_session_id and mp.ready_scene_id=reset_mission_readiness.p_scene_id and mp.status<>'removed';
end $$;

revoke all on function public.create_mission_session(uuid),public.set_mission_scene(uuid,text),public.navigate_mission_scene(uuid,integer),public.reset_mission_readiness(uuid,text) from public,anon;
grant execute on function public.create_mission_session(uuid),public.set_mission_scene(uuid,text),public.navigate_mission_scene(uuid,integer),public.reset_mission_readiness(uuid,text) to authenticated;
commit;
