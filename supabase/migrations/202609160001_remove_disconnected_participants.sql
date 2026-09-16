-- Additive bulk cleanup for participants whose heartbeat has unambiguously expired.
begin;

create or replace function public.remove_disconnected_mission_participants(p_session_id uuid)
returns table(removed_count bigint)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<remove_disconnected_mission_participants>>
begin
  if not public.is_mission_teacher(remove_disconnected_mission_participants.p_session_id) then
    raise exception using errcode='PT403',message='MISSION_FORBIDDEN';
  end if;
  if exists(select 1 from public.mission_sessions as ms where ms.id=remove_disconnected_mission_participants.p_session_id and ms.status='completed') then
    raise exception using errcode='PT409',message='MISSION_COMPLETED';
  end if;
  return query
  with removed as (
    update public.mission_participants as mp
       set status='removed', ready_scene_id=null, removed_at=pg_catalog.now()
     where mp.session_id=remove_disconnected_mission_participants.p_session_id
       and mp.status<>'removed'
       and mp.last_seen_at < pg_catalog.now() - interval '70 seconds'
    returning 1
  ) select pg_catalog.count(*) from removed;
end $$;

revoke all on function public.remove_disconnected_mission_participants(uuid) from public,anon;
grant execute on function public.remove_disconnected_mission_participants(uuid) to authenticated;
commit;
