-- Workflow authority cutover: Supabase-only
-- Moves multi-table mutations out of the React client and into transactional RPCs.

create or replace function public.rpc_submit_daily_inspection(
  p_operation_id text,
  p_equipment_id text,
  p_shift text,
  p_area text,
  p_overall_mark text,
  p_note text default '',
  p_damaged_parts text default '',
  p_priority text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_suffix text;
  v_inspection_id text;
  v_work_order_id text := '';
  v_downtime_id text := '';
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'INSPECTION_ROLE_DENIED'; end if;
  if p_overall_mark not in ('V','URGENT_REPAIR','MAINTENANCE_REQUIRED','STOP_REPAIR') then raise exception 'INVALID_INSPECTION_MARK'; end if;
  if p_shift not in ('MORNING','AFTERNOON','NIGHT') then raise exception 'INVALID_INSPECTION_SHIFT'; end if;
  if p_overall_mark = 'STOP_REPAIR' and coalesce(trim(p_note),'') = '' then raise exception 'STOP_REPAIR_NOTE_REQUIRED'; end if;
  if not exists (select 1 from public.equipment_master where equipment_id = p_equipment_id and equipment_type='PRODUCTION' and active=true) then raise exception 'PRODUCTION_EQUIPMENT_NOT_FOUND'; end if;

  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_inspection_id := 'INSP-' || v_suffix;

  insert into public.daily_inspection(inspection_id,equipment_id,inspection_date,shift,area,overall_mark,note,actor_email,source_data)
  values(v_inspection_id,p_equipment_id,current_date,p_shift,nullif(trim(p_area),''),p_overall_mark,nullif(trim(p_note),''),v_actor,
    jsonb_build_object('damagedParts',coalesce(trim(p_damaged_parts),''),'operationId',p_operation_id));

  if p_overall_mark = 'STOP_REPAIR' then
    v_work_order_id := 'WO-' || v_suffix;
    v_downtime_id := 'DT-' || v_suffix;
    insert into public.maintenance_work_order(work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data)
    values(v_work_order_id,p_equipment_id,'OPEN',coalesce(nullif(trim(p_priority),''),'CRITICAL'),trim(p_note),'DAILY_INSPECTION',v_inspection_id,v_actor,
      jsonb_build_object('damagedParts',coalesce(trim(p_damaged_parts),''),'operationId',p_operation_id));
    insert into public.downtime_event(downtime_id,equipment_id,work_order_id,started_at,source_data)
    values(v_downtime_id,p_equipment_id,v_work_order_id,now(),jsonb_build_object('inspectionId',v_inspection_id,'operationId',p_operation_id));
    update public.equipment_master set status='DOWN', updated_at=now() where equipment_id=p_equipment_id;
  end if;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||v_suffix,p_equipment_id,'Daily_Inspection',v_inspection_id,'CREATE',v_actor,
    jsonb_build_object('mark',p_overall_mark,'workOrderId',v_work_order_id,'operationId',p_operation_id));

  return jsonb_build_object('inspectionId',v_inspection_id,'workOrderId',v_work_order_id,'downtimeId',v_downtime_id);
end $$;

create or replace function public.rpc_create_maintenance_work_order(
  p_operation_id text,
  p_equipment_id text,
  p_source_type text,
  p_source_id text,
  p_reason text,
  p_priority text,
  p_method text default '',
  p_planned_start_at text default '',
  p_planned_end_at text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_suffix text;
  v_work_order_id text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'MAINTENANCE_ROLE_DENIED'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'WORK_ORDER_REASON_REQUIRED'; end if;
  if not exists (select 1 from public.equipment_master where equipment_id=p_equipment_id and equipment_type='PRODUCTION' and active=true) then raise exception 'PRODUCTION_EQUIPMENT_NOT_FOUND'; end if;
  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_work_order_id := 'WO-'||v_suffix;
  insert into public.maintenance_work_order(work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data)
  values(v_work_order_id,p_equipment_id,'OPEN',nullif(trim(p_priority),''),trim(p_reason),coalesce(nullif(trim(p_source_type),''),'MANUAL'),nullif(trim(p_source_id),''),v_actor,
    jsonb_build_object('operationId',p_operation_id,'method',coalesce(p_method,''),'plannedStartAt',coalesce(p_planned_start_at,''),'plannedEndAt',coalesce(p_planned_end_at,'')));
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||v_suffix,p_equipment_id,'Maintenance_Work_Order',v_work_order_id,'CREATE',v_actor,jsonb_build_object('operationId',p_operation_id));
  return jsonb_build_object('workOrderId',v_work_order_id,'status','OPEN');
end $$;

create or replace function public.rpc_transition_maintenance(
  p_work_order_id text,
  p_action text,
  p_operation_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_wo public.maintenance_work_order%rowtype;
  v_next text;
  v_source jsonb;
  v_suffix text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  select * into v_wo from public.maintenance_work_order where work_order_id=p_work_order_id for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;

  case p_action
    when 'REQUEST_APPROVAL' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'OPEN' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'WAITING_APPROVAL';
    when 'APPROVE' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'WAITING_APPROVAL' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'APPROVED';
    when 'START' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'APPROVED' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'IN_PROGRESS';
    when 'COMPLETE' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'IN_PROGRESS' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'COMPLETED';
    when 'VERIFY' then
      if v_role not in ('SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'COMPLETED' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'VERIFIED';
    when 'RELEASE' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'VERIFIED' then raise exception 'INVALID_TRANSITION'; end if;
      if not exists (select 1 from public.equipment_handover where work_order_id=p_work_order_id and accepted=true) then raise exception 'HANDOVER_ACCEPTED_REQUIRED'; end if;
      v_next := 'RELEASED';
    else raise exception 'UNKNOWN_MAINTENANCE_ACTION';
  end case;

  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_source := coalesce(v_wo.source_data,'{}'::jsonb) || jsonb_build_object('lastOperationId',p_operation_id);
  if p_action='APPROVE' then v_source := v_source || jsonb_build_object('approvedBy',v_actor,'approvedAt',now()); end if;
  update public.maintenance_work_order set status=v_next, source_data=v_source, updated_at=now() where work_order_id=p_work_order_id;

  if p_action='RELEASE' then
    update public.downtime_event set ended_at=coalesce(ended_at,now()) where work_order_id=p_work_order_id and ended_at is null;
    update public.equipment_master set status='RUNNING',updated_at=now() where equipment_id=v_wo.equipment_id;
  end if;

  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||v_suffix,v_wo.equipment_id,'Maintenance_Work_Order',p_work_order_id,p_action,v_actor,jsonb_build_object('before',v_wo.status,'after',v_next,'operationId',p_operation_id));
  return jsonb_build_object('status',v_next);
end $$;

create or replace function public.rpc_create_tooling(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id text; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  if v_role not in ('MANAGER','ADMIN') then raise exception 'TOOLING_MASTER_ROLE_DENIED'; end if;
  v_id:=trim(p_input->>'toolingId'); if v_id='' then raise exception 'TOOLING_ID_REQUIRED'; end if;
  insert into public.tooling_master(tooling_id,tooling_type,status,ownership,source_data)
  values(v_id,nullif(trim(p_input->>'toolingType'),''),coalesce(nullif(trim(p_input->>'status'),''),'IN_PRODUCTION'),nullif(trim(p_input->>'ownership'),''),p_input);
  return jsonb_build_object('toolingId',v_id);
end $$;

create or replace function public.rpc_create_tooling_plan(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id text; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'TOOLING_PLAN_ROLE_DENIED'; end if;
  v_id:='TPL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.tooling_maintenance_plan(tooling_plan_id,tooling_id,frequency_type,source_data)
  values(v_id,trim(p_input->>'toolingId'),nullif(trim(p_input->>'frequencyType'),''),p_input);
  return jsonb_build_object('toolingPlanId',v_id);
end $$;

create or replace function public.rpc_create_tooling_modification(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id text; v_actor text; v_source jsonb; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'TOOLING_MOD_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text); v_id:='TMOD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_source:=p_input||jsonb_build_object('proposedBy',v_actor);
  insert into public.tooling_modification(modification_id,tooling_id,modification_type,status,source_data)
  values(v_id,trim(p_input->>'toolingId'),nullif(trim(p_input->>'modificationType'),''),'PROPOSED',v_source);
  return jsonb_build_object('modificationId',v_id,'status','PROPOSED');
end $$;

create or replace function public.rpc_transition_tooling_modification(p_modification_id text,p_action text,p_updated_documents text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_actor text; v_row public.tooling_modification%rowtype; v_source jsonb; v_status text; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  select * into v_row from public.tooling_modification where modification_id=p_modification_id for update; if not found then raise exception 'MODIFICATION_NOT_FOUND'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text); v_source:=coalesce(v_row.source_data,'{}'::jsonb); v_status:=v_row.status;
  if p_action='APPROVE' then
    if v_role not in ('MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; if v_status<>'PROPOSED' then raise exception 'INVALID_TRANSITION'; end if;
    v_source:=v_source||jsonb_build_object('approvedBy',v_actor,'approvedAt',now()); v_status:='APPROVED';
  elsif p_action='QA_CONFIRM' then
    if v_role not in ('QUALITY','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; if v_status not in ('PROPOSED','APPROVED') then raise exception 'INVALID_TRANSITION'; end if;
    v_source:=v_source||jsonb_build_object('qaConfirmedBy',v_actor,'qaConfirmedAt',now()); v_status:='QA_CONFIRMED';
  elsif p_action='COMPLETE' then
    if v_role not in ('MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
    if coalesce(v_source->>'approvedBy','')='' or coalesce(v_source->>'qaConfirmedBy','')='' then raise exception 'APPROVAL_AND_QA_REQUIRED'; end if;
    v_source:=v_source||jsonb_build_object('updatedDocuments',coalesce(p_updated_documents,''),'completedBy',v_actor,'completedAt',now()); v_status:='COMPLETED';
  else raise exception 'UNKNOWN_TOOLING_ACTION'; end if;
  update public.tooling_modification set status=v_status,source_data=v_source,updated_at=now() where modification_id=p_modification_id;
  return jsonb_build_object('modificationId',p_modification_id,'status',v_status);
end $$;

grant execute on function public.rpc_submit_daily_inspection(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.rpc_create_maintenance_work_order(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.rpc_transition_maintenance(text,text,text) to authenticated;
grant execute on function public.rpc_create_tooling(jsonb) to authenticated;
grant execute on function public.rpc_create_tooling_plan(jsonb) to authenticated;
grant execute on function public.rpc_create_tooling_modification(jsonb) to authenticated;
grant execute on function public.rpc_transition_tooling_modification(text,text,text) to authenticated;
