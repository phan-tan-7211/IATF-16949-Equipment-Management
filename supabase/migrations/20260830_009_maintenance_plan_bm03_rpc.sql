create or replace function public.rpc_upsert_maintenance_plan(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_plan_id text;
  v_equipment_id text;
  v_existing public.maintenance_plan%rowtype;
  v_item jsonb;
  v_item_id text;
  v_count int := 0;
  v_source jsonb;
  v_audit text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'MAINTENANCE_PLAN_ROLE_DENIED'; end if;

  v_equipment_id:=upper(trim(coalesce(p_input->>'equipmentId','')));
  if v_equipment_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id and equipment_type='PRODUCTION' and active=true) then
    raise exception 'PRODUCTION_EQUIPMENT_NOT_FOUND';
  end if;
  if trim(coalesce(p_input->>'maintenanceType',''))='' then raise exception 'MAINTENANCE_TYPE_REQUIRED'; end if;
  if trim(coalesce(p_input->>'frequency',''))='' then raise exception 'FREQUENCY_REQUIRED'; end if;

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_plan_id:=trim(coalesce(p_input->>'planId',''));
  if v_plan_id='' then
    v_plan_id:='MP-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  end if;

  v_source:=p_input - 'items' || jsonb_build_object('equipmentId',v_equipment_id,'updatedBy',v_actor,'updatedAt',now());
  select * into v_existing from public.maintenance_plan where plan_id=v_plan_id for update;

  if found then
    update public.maintenance_plan
      set equipment_id=v_equipment_id, active=coalesce((p_input->>'active')::boolean,true), source_data=v_source
      where plan_id=v_plan_id;
    delete from public.maintenance_plan_item where plan_id=v_plan_id;
  else
    insert into public.maintenance_plan(plan_id,equipment_id,active,source_data)
    values(v_plan_id,v_equipment_id,coalesce((p_input->>'active')::boolean,true),v_source);
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_input->'items','[]'::jsonb)) loop
    if trim(coalesce(v_item->>'itemName',''))='' then continue; end if;
    v_count:=v_count+1;
    v_item_id:=v_plan_id||'-I'||lpad(v_count::text,3,'0');
    insert into public.maintenance_plan_item(item_id,plan_id,equipment_id,source_data)
    values(v_item_id,v_plan_id,v_equipment_id,v_item||jsonb_build_object('sequence',v_count));
  end loop;

  if v_count=0 then raise exception 'MAINTENANCE_PLAN_ITEM_REQUIRED'; end if;

  v_audit:='AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(v_audit,v_equipment_id,'Maintenance_Plan',v_plan_id,case when v_existing.plan_id is null then 'CREATE' else 'UPDATE' end,v_actor,
    jsonb_build_object('maintenanceType',p_input->>'maintenanceType','frequency',p_input->>'frequency','plannedDate',p_input->>'plannedDate','responsiblePerson',p_input->>'responsiblePerson','itemCount',v_count));

  return jsonb_build_object('planId',v_plan_id,'equipmentId',v_equipment_id,'itemCount',v_count);
end $$;

grant execute on function public.rpc_upsert_maintenance_plan(jsonb) to authenticated;
