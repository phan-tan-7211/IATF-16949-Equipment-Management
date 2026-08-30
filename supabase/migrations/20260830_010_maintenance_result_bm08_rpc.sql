create or replace function public.rpc_record_maintenance_result(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_work_order public.maintenance_work_order%rowtype;
  v_execution_id text;
  v_item jsonb;
  v_item_id text;
  v_mark text;
  v_count int := 0;
  v_abnormal int := 0;
  v_source jsonb;
  v_audit text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'MAINTENANCE_RESULT_ROLE_DENIED'; end if;

  select * into v_work_order
  from public.maintenance_work_order
  where work_order_id=trim(coalesce(p_input->>'workOrderId',''))
  for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if v_work_order.status not in ('IN_PROGRESS','COMPLETED') then raise exception 'WORK_ORDER_NOT_READY_FOR_RESULT'; end if;

  if trim(coalesce(p_input->>'executionDate',''))='' then raise exception 'EXECUTION_DATE_REQUIRED'; end if;
  if trim(coalesce(p_input->>'inspectionDepartment',''))='' then raise exception 'INSPECTION_DEPARTMENT_REQUIRED'; end if;

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_execution_id:='MEX-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_source:=(p_input - 'items') || jsonb_build_object('recordedBy',v_actor,'recordedAt',now());

  insert into public.maintenance_execution(execution_id,work_order_id,equipment_id,source_data)
  values(v_execution_id,v_work_order.work_order_id,v_work_order.equipment_id,v_source);

  for v_item in select value from jsonb_array_elements(coalesce(p_input->'items','[]'::jsonb)) loop
    if trim(coalesce(v_item->>'itemName',''))='' then continue; end if;
    v_mark:=upper(trim(coalesce(v_item->>'resultMark','')));
    if v_mark not in ('○','△','×','O','V','X') then raise exception 'MAINTENANCE_RESULT_MARK_INVALID'; end if;
    if v_mark in ('△','×','X') and trim(coalesce(v_item->>'repairContent',''))='' and trim(coalesce(v_item->>'maintenanceContent',''))='' then
      raise exception 'ABNORMAL_RESULT_ACTION_REQUIRED';
    end if;
    v_count:=v_count+1;
    if v_mark in ('△','×','X') then v_abnormal:=v_abnormal+1; end if;
    v_item_id:=v_execution_id||'-I'||lpad(v_count::text,3,'0');
    insert into public.maintenance_result_item(result_item_id,execution_id,work_order_id,equipment_id,source_data)
    values(v_item_id,v_execution_id,v_work_order.work_order_id,v_work_order.equipment_id,
      v_item||jsonb_build_object('sequence',v_count,'resultMark',case when v_mark in ('O','V') then '○' when v_mark='X' then '×' else v_mark end));
  end loop;

  if v_count=0 then raise exception 'MAINTENANCE_RESULT_ITEM_REQUIRED'; end if;

  insert into public.maintenance_log(log_id,work_order_id,equipment_id,action,actor_email,source_data)
  values('ML-'||substr(replace(gen_random_uuid()::text,'-',''),1,12),v_work_order.work_order_id,v_work_order.equipment_id,'BM08_RESULT_RECORDED',v_actor,
    jsonb_build_object('executionId',v_execution_id,'itemCount',v_count,'abnormalCount',v_abnormal,'executionDate',p_input->>'executionDate'));

  v_audit:='AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(v_audit,v_work_order.equipment_id,'Maintenance_Execution',v_execution_id,'RECORD_BM08',v_actor,
    jsonb_build_object('workOrderId',v_work_order.work_order_id,'itemCount',v_count,'abnormalCount',v_abnormal));

  return jsonb_build_object('executionId',v_execution_id,'workOrderId',v_work_order.work_order_id,'equipmentId',v_work_order.equipment_id,'itemCount',v_count,'abnormalCount',v_abnormal);
end $$;

grant execute on function public.rpc_record_maintenance_result(jsonb) to authenticated;
