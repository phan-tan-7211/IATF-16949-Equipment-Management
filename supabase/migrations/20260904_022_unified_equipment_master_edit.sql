create or replace function public.rpc_update_equipment_details(p_equipment_id text, p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.equipment_master%rowtype;
  v_actor text;
  v_audit_id text;
  v_controls_quality boolean;
  v_special boolean;
  v_stops boolean;
  v_backup boolean;
  v_capacity boolean;
  v_criticality text;
  v_source jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if coalesce(trim(p_equipment_id), '') = '' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if p_input is null then raise exception 'EQUIPMENT_INPUT_REQUIRED'; end if;

  select * into v_old from public.equipment_master where equipment_id = trim(p_equipment_id) for update;
  if not found then raise exception 'EQUIPMENT_NOT_FOUND'; end if;

  if jsonb_typeof(p_input->'controlsProductQuality') <> 'boolean'
    or jsonb_typeof(p_input->'specialCharacteristicImpact') <> 'boolean'
    or jsonb_typeof(p_input->'stopsProduction') <> 'boolean'
    or jsonb_typeof(p_input->'hasBackup') <> 'boolean'
    or jsonb_typeof(p_input->'capacityImpact') <> 'boolean' then
    raise exception 'CRITICALITY_FACTS_REQUIRED';
  end if;

  v_controls_quality := (p_input->>'controlsProductQuality')::boolean;
  v_special := (p_input->>'specialCharacteristicImpact')::boolean;
  v_stops := (p_input->>'stopsProduction')::boolean;
  v_backup := (p_input->>'hasBackup')::boolean;
  v_capacity := (p_input->>'capacityImpact')::boolean;

  v_criticality := case
    when v_special then 'A'
    when not v_backup and (v_controls_quality or v_stops or v_capacity) then 'A'
    when v_controls_quality or v_stops or v_capacity then 'B'
    when not v_backup then 'C'
    else 'D'
  end;

  v_source := coalesce(v_old.source_data, '{}'::jsonb) || jsonb_build_object(
    'equipmentCategory', coalesce(trim(p_input->>'equipmentCategory'), ''),
    'currentArea', coalesce(trim(p_input->>'currentArea'), ''),
    'currentLine', coalesce(trim(p_input->>'currentLine'), ''),
    'managingDepartment', coalesce(trim(p_input->>'managingDepartment'), ''),
    'usingDepartment', coalesce(trim(p_input->>'department'), ''),
    'technicalSpecification', coalesce(trim(p_input->>'technicalSpecification'), ''),
    'criticality', v_criticality,
    'criticalityRule', 'CEV-ABCD-V2',
    'criticalityFacts', jsonb_build_object(
      'controlsProductQuality', v_controls_quality,
      'specialCharacteristicImpact', v_special,
      'stopsProduction', v_stops,
      'hasBackup', v_backup,
      'capacityImpact', v_capacity
    )
  );

  update public.equipment_master
  set equipment_name = coalesce(nullif(trim(p_input->>'equipmentName'), ''), v_old.equipment_name),
      manufacturer = coalesce(trim(p_input->>'manufacturer'), ''),
      model = coalesce(trim(p_input->>'model'), ''),
      serial_number = coalesce(trim(p_input->>'serialNumber'), ''),
      department = coalesce(trim(p_input->>'department'), ''),
      status = coalesce(nullif(trim(p_input->>'status'), ''), v_old.status),
      qr_code = v_old.equipment_id,
      source_data = v_source,
      updated_at = now()
  where equipment_id = v_old.equipment_id;

  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text, 'unknown');
  v_audit_id := 'AUD-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    v_audit_id,
    v_old.equipment_id,
    'Equipment_Master',
    v_old.equipment_id,
    'UPDATE_DETAILS',
    v_actor,
    jsonb_build_object(
      'before', jsonb_build_object('name',v_old.equipment_name,'manufacturer',v_old.manufacturer,'model',v_old.model,'serial',v_old.serial_number,'department',v_old.department,'status',v_old.status,'sourceData',v_old.source_data),
      'after', jsonb_build_object('name',coalesce(nullif(trim(p_input->>'equipmentName'), ''),v_old.equipment_name),'manufacturer',coalesce(trim(p_input->>'manufacturer'),''),'model',coalesce(trim(p_input->>'model'),''),'serial',coalesce(trim(p_input->>'serialNumber'),''),'department',coalesce(trim(p_input->>'department'),''),'status',coalesce(nullif(trim(p_input->>'status'),''),v_old.status),'criticality',v_criticality,'sourceData',v_source)
    )
  );

  return jsonb_build_object('equipmentId', v_old.equipment_id, 'criticality', v_criticality);
end;
$$;

grant execute on function public.rpc_update_equipment_details(text, jsonb) to authenticated;
