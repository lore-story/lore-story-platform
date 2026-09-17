-- Synchronisiert Countdown und Abschluss der Astra-Startsequenz über die Missionssitzung.
begin;

alter table public.mission_sessions
  add column finale_started_at timestamptz,
  add column finale_target_at timestamptz,
  add column finale_status text not null default 'idle'
    check (finale_status in ('idle','countdown','launch','finished'));

grant select(finale_started_at,finale_target_at,finale_status) on public.mission_sessions to authenticated;

create or replace function public.start_mission_finale(p_session_id uuid)
returns setof public.mission_sessions
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_mission_teacher(p_session_id) then
    raise exception using errcode='PT403',message='MISSION_FORBIDDEN';
  end if;
  return query update public.mission_sessions as ms set
    finale_started_at=pg_catalog.clock_timestamp(),
    finale_target_at=pg_catalog.clock_timestamp()+interval '10 seconds',
    finale_status='countdown'
  where ms.id=p_session_id and ms.status<>'completed' and ms.current_scene_id='startfreigabe'
    and ms.finale_status='idle'
  returning ms.*;
  if not found then raise exception using errcode='PT409',message='FINALE_ALREADY_STARTED'; end if;
end $$;

create or replace function public.finish_mission_finale(p_session_id uuid)
returns setof public.mission_sessions
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_mission_teacher(p_session_id) then
    raise exception using errcode='PT403',message='MISSION_FORBIDDEN';
  end if;
  return query update public.mission_sessions as ms set finale_status='finished'
  where ms.id=p_session_id and ms.status<>'completed'
    and ms.finale_status in ('countdown','launch') and ms.finale_target_at<=pg_catalog.clock_timestamp()
  returning ms.*;
  if not found then raise exception using errcode='PT409',message='FINALE_NOT_READY'; end if;
end $$;

revoke all on function public.start_mission_finale(uuid),public.finish_mission_finale(uuid) from public,anon;
grant execute on function public.start_mission_finale(uuid),public.finish_mission_finale(uuid) to authenticated;

commit;
