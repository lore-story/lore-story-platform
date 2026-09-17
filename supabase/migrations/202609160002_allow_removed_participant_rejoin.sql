-- Removal ends the current participation, but does not permanently ban the anonymous session.
begin;

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
 select mp.* into v_participant from public.mission_participants as mp where mp.session_id=v_session.id and mp.auth_user_id=auth.uid(); v_participant_found := found;
 if v_session.status='completed' and not v_participant_found then raise exception using errcode='PT410',message='MISSION_COMPLETED'; end if;
 return query select v_session.id,v_participant.id,v_session.title,v_session.status,v_session.joining_open,public.mission_callsigns(),
   coalesce((select pg_catalog.array_agg(mp.callsign order by mp.callsign) from public.mission_participants mp where mp.session_id=v_session.id and mp.status<>'removed'),'{}'::text[]),
   v_participant.status,v_participant.callsign,v_session.current_scene_id,v_participant.ready_scene_id;
end $$;

create or replace function public.join_mission(p_code text,p_callsign text)
returns table(session_id uuid,participant_id uuid,title text,status text,joining_open boolean,current_scene_id text,callsign text,ready_scene_id text)
language plpgsql security definer set search_path='' as $$
#variable_conflict error
<<join_mission>>
declare v_session public.mission_sessions; v_participant public.mission_participants; v_participant_found boolean; v_callsign text := pg_catalog.btrim(join_mission.p_callsign);
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false then raise exception using errcode='PT401',message='ANONYMOUS_AUTH_REQUIRED'; end if;
 select ms.* into v_session from public.mission_sessions ms where ms.join_code=pg_catalog.upper(pg_catalog.btrim(join_mission.p_code)) for update;
 if not found then raise exception using errcode='PT404',message='INVALID_CODE'; end if;
 if v_session.status='completed' then raise exception using errcode='PT409',message='MISSION_COMPLETED'; end if;
 select mp.* into v_participant from public.mission_participants mp where mp.session_id=v_session.id and mp.auth_user_id=auth.uid() for update; v_participant_found := found;
 if not v_participant_found then
   if not v_session.joining_open then raise exception using errcode='PT403',message='JOINING_CLOSED'; end if;
   if not (v_callsign=any(public.mission_callsigns())) then raise exception using errcode='PT400',message='INVALID_CALLSIGN'; end if;
   begin
     insert into public.mission_participants as mp(session_id,auth_user_id,callsign) values(v_session.id,auth.uid(),v_callsign) returning mp.* into v_participant;
   exception when unique_violation then raise exception using errcode='23505',message='CALLSIGN_TAKEN'; end;
 elsif v_participant.status<>'removed' then
   -- A reconnect can restore presence, but must never rename an existing participant.
   update public.mission_participants mp set status='connected',last_seen_at=pg_catalog.now()
    where mp.id=v_participant.id returning mp.* into v_participant;
 else
   if not v_session.joining_open then raise exception using errcode='PT403',message='JOINING_CLOSED'; end if;
   if not (v_callsign=any(public.mission_callsigns())) then raise exception using errcode='PT400',message='INVALID_CALLSIGN'; end if;
   begin
     update public.mission_participants mp set callsign=v_callsign,status='connected',ready_scene_id=null,last_seen_at=pg_catalog.now(),removed_at=null,joined_at=pg_catalog.now()
      where mp.id=v_participant.id returning mp.* into v_participant;
   exception when unique_violation then raise exception using errcode='23505',message='CALLSIGN_TAKEN'; end;
 end if;
 return query select v_session.id,v_participant.id,v_session.title,v_session.status,v_session.joining_open,v_session.current_scene_id,v_participant.callsign,v_participant.ready_scene_id;
end $$;

revoke all on function public.inspect_mission(text),public.join_mission(text,text) from public,anon;
grant execute on function public.inspect_mission(text),public.join_mission(text,text) to authenticated;
commit;
