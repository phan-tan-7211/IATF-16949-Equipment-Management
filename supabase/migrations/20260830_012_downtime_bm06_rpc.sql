create or replace function public.rpc_upsert_downtime_event_bm06(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_id text;
  v_equipment_id text;
  v_started timestamptz;
  v_ended timestamptz;
  v_category text;
  v_existing public.downtime_event%rowtype;
  v_source jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'DOWNTIME_ROLE_DENIED'; end if;

  v_id:=trim(coalesce(p_input->>'downtimeId',''));
  v_equipment_id:=upper(trim(coalesce(p_input->>'equipmentId','')));
  if v_equipment_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id and equipment_type='PRODUCTION' and active=true) then raise exception 'PRODUCTION_EQUIPMENT_NOT_FOUND'; end if;

  v_category:=upper(trim(coalesce(p_input->>'causeCategory','')));
  if v_category not in ('MECHANICAL','ELECTRICAL','WAITING_MATERIAL','UNPLANNED_MAINTENANCE','SETUP_CHANGEOVER','NO_OPERATOR','MATERIAL_SHORTAGE','PROCESS_ERROR','OTHER') then
    raise exception 'DOWNTIME_CAUSE_CATEGORY_INVALID';
  end if;
  if trim(coalesce(p_input->>'detail',''))='' then raise exception 'DOWNTIME_DETAIL_REQUIRED'; end if;

  if nullif(trim(coalesce(p_input->>'startedAt','')),'') is not null then v_started:=(p_input->>'startedAt')::timestamptz; end if;
  if nullif(trim(coalesce(p_input->>'endedAt','')),'') is not null then v_ended:=(p_input->>'endedAt')::timestamptz; end if;
  if v_ended is not null and v_started is not null and v_ended<v_started then raise exception 'DOWNTIME_END_BEFORE_START'; end if;

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_source:=p_input||jsonb_build_object('updatedBy',v_actor,'updatedAt',now());

  if v_id<>'' then
    select * into v_existing from public.downtime_event where downtime_id=v_id for update;
    if not found then raise exception 'DOWNTIME_NOT_FOUND'; end if;
    if v_existing.equipment_id<>v_equipment_id then raise exception 'DOWNTIME_EQUIPMENT_MISMATCH'; end if;
    update public.downtime_event
      set started_at=coalesce(v_started,v_existing.started_at),
          ended_at=case when p_input ? 'endedAt' then v_ended else v_existing.ended_at end,
          work_order_id=coalesce(nullif(trim(coalesce(p_input->>'workOrderId','')),''),v_existing.work_order_id),
          source_data=coalesce(v_existing.source_data,'{}'::jsonb)||v_source
      where downtime_id=v_id;
  else
    if v_started is null then raise exception 'DOWNTIME_START_REQUIRED'; end if;
    v_id:='DT-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
    insert into public.downtime_event(downtime_id,equipment_id,work_order_id,started_at,ended_at,source_data)
    values(v_id,v_equipment_id,nullif(trim(coalesce(p_input->>'workOrderId','')),''),v_started,v_ended,v_source);
  end if;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_equipment_id,'Downtime_Event',v_id,case when v_existing.downtime_id is null then 'RECORD_BM06' else 'UPDATE_BM06' end,v_actor,
    jsonb_build_object('causeCategory',v_category,'startedAt',coalesce(v_started,v_existing.started_at),'endedAt',case when p_input ? 'endedAt' then v_ended else v_existing.ended_at end));

  return jsonb_build_object('downtimeId',v_id,'equipmentId',v_equipment_id);
end $$;

grant execute on function public.rpc_upsert_downtime_event_bm06(jsonb) to authenticated;
