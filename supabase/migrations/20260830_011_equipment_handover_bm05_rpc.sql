create or replace function public.rpc_record_equipment_handover(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_equipment_id text;
  v_work_order_id text;
  v_handover_id text;
  v_accepted boolean;
  v_condition text;
  v_source jsonb;
  v_wo public.maintenance_work_order%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'HANDOVER_ROLE_DENIED'; end if;

  v_equipment_id:=upper(trim(coalesce(p_input->>'equipmentId','')));
  v_work_order_id:=trim(coalesce(p_input->>'workOrderId',''));
  if v_equipment_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id and active=true) then raise exception 'EQUIPMENT_NOT_FOUND'; end if;

  if v_work_order_id<>'' then
    select * into v_wo from public.maintenance_work_order where work_order_id=v_work_order_id and equipment_id=v_equipment_id for update;
    if not found then raise exception 'HANDOVER_WORK_ORDER_MISMATCH'; end if;
    if v_wo.status<>'VERIFIED' then raise exception 'WORK_ORDER_NOT_VERIFIED'; end if;
  end if;

  if trim(coalesce(p_input->>'handoverPerson',''))='' then raise exception 'HANDOVER_PERSON_REQUIRED'; end if;
  if trim(coalesce(p_input->>'receiverPerson',''))='' then raise exception 'RECEIVER_PERSON_REQUIRED'; end if;
  if trim(coalesce(p_input->>'handoverReason',''))='' then raise exception 'HANDOVER_REASON_REQUIRED'; end if;
  v_condition:=trim(coalesce(p_input->>'equipmentCondition',''));
  if v_condition not in ('NORMAL','MINOR_ISSUE','NOT_OPERATIONAL') then raise exception 'HANDOVER_CONDITION_INVALID'; end if;
  v_accepted:=coalesce((p_input->>'accepted')::boolean,false);

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_handover_id:='HO-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_source:=p_input||jsonb_build_object('recordedBy',v_actor,'recordedAt',now());

  insert into public.equipment_handover(handover_id,work_order_id,equipment_id,accepted,equipment_condition,source_data)
  values(v_handover_id,nullif(v_work_order_id,''),v_equipment_id,v_accepted,v_condition,v_source);

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_equipment_id,'Equipment_Handover',v_handover_id,'RECORD_BM05',v_actor,
    jsonb_build_object('workOrderId',v_work_order_id,'accepted',v_accepted,'condition',v_condition,'receiverPerson',p_input->>'receiverPerson'));

  return jsonb_build_object('handoverId',v_handover_id,'equipmentId',v_equipment_id,'workOrderId',v_work_order_id,'accepted',v_accepted);
end $$;

grant execute on function public.rpc_record_equipment_handover(jsonb) to authenticated;
