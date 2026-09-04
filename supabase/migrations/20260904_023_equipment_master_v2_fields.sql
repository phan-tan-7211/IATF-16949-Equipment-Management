-- Equipment Master V2: keep Create/Edit payloads aligned and persist lifecycle metadata in source_data.
-- IDs, QR, active, timestamps and criticality result remain system-managed.

create or replace function public.rpc_create_equipment_auto(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_type public.equipment_type;
  v_id text;
  v_name text;
  v_criticality text;
  v_controls_product_quality boolean;
  v_special_characteristic_impact boolean;
  v_stops_production boolean;
  v_has_backup boolean;
  v_capacity_impact boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'EQUIPMENT_CREATE_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_type:=upper(trim(coalesce(p_input->>'equipmentType','PRODUCTION')))::public.equipment_type;
  v_name:=trim(regexp_replace(coalesce(p_input->>'equipmentName',''),'\s+',' ','g'));
  if v_name='' then raise exception 'EQUIPMENT_NAME_REQUIRED'; end if;

  v_controls_product_quality:=nullif(p_input->>'controlsProductQuality','')::boolean;
  v_special_characteristic_impact:=nullif(p_input->>'specialCharacteristicImpact','')::boolean;
  v_stops_production:=nullif(p_input->>'stopsProduction','')::boolean;
  v_has_backup:=nullif(p_input->>'hasBackup','')::boolean;
  v_capacity_impact:=nullif(p_input->>'capacityImpact','')::boolean;
  if v_controls_product_quality is null or v_special_characteristic_impact is null or v_stops_production is null or v_has_backup is null or v_capacity_impact is null then
    raise exception 'CRITICALITY_FACTS_REQUIRED';
  end if;

  v_criticality:=case
    when v_special_characteristic_impact then 'A'
    when not v_has_backup and (v_controls_product_quality or v_stops_production or v_capacity_impact) then 'A'
    when v_controls_product_quality or v_stops_production or v_capacity_impact then 'B'
    when not v_has_backup then 'C'
    else 'D'
  end;
  v_id:=public.next_equipment_id(v_type);

  insert into public.equipment_master(equipment_id,equipment_type,qr_code,equipment_name,model,manufacturer,serial_number,department,status,active,source_data)
  values(
    v_id,v_type,v_id,v_name,
    nullif(trim(regexp_replace(coalesce(p_input->>'model',''),'\s+',' ','g')),''),
    nullif(trim(regexp_replace(coalesce(p_input->>'manufacturer',''),'\s+',' ','g')),''),
    nullif(trim(regexp_replace(coalesce(p_input->>'serialNumber',''),'\s+',' ','g')),''),
    nullif(trim(regexp_replace(coalesce(p_input->>'department',''),'\s+',' ','g')),''),
    coalesce(nullif(trim(p_input->>'status'),''),'RUNNING'),true,
    jsonb_strip_nulls(jsonb_build_object(
      'equipmentCategory',nullif(trim(regexp_replace(coalesce(p_input->>'equipmentCategory',''),'\s+',' ','g')),''),
      'currentArea',nullif(trim(regexp_replace(coalesce(p_input->>'currentArea',''),'\s+',' ','g')),''),
      'currentLine',nullif(trim(regexp_replace(coalesce(p_input->>'currentLine',''),'\s+',' ','g')),''),
      'managingDepartment',nullif(trim(regexp_replace(coalesce(p_input->>'managingDepartment',''),'\s+',' ','g')),''),
      'usingDepartment',nullif(trim(regexp_replace(coalesce(p_input->>'department',''),'\s+',' ','g')),''),
      'technicalSpecification',nullif(trim(regexp_replace(coalesce(p_input->>'technicalSpecification',''),'\s+',' ','g')),''),
      'description',nullif(trim(regexp_replace(coalesce(p_input->>'description',''),'\s+',' ','g')),''),
      'accuracy',nullif(trim(regexp_replace(coalesce(p_input->>'accuracy',''),'\s+',' ','g')),''),
      'origin',nullif(trim(regexp_replace(coalesce(p_input->>'origin',''),'\s+',' ','g')),''),
      'manufactureDate',nullif(trim(p_input->>'manufactureDate'),''),
      'inServiceDate',nullif(trim(p_input->>'inServiceDate'),''),
      'warrantyUntil',nullif(trim(p_input->>'warrantyUntil'),''),
      'warrantyContact',nullif(trim(regexp_replace(coalesce(p_input->>'warrantyContact',''),'\s+',' ','g')),''),
      'note',nullif(trim(regexp_replace(coalesce(p_input->>'note',''),'\s+',' ','g')),''),
      'relatedDocuments',nullif(trim(regexp_replace(coalesce(p_input->>'relatedDocuments',''),'\s+',' ','g')),''),
      'criticality',v_criticality,'criticalityRule','CEV-ABCD-V2',
      'criticalityFacts',jsonb_build_object('controlsProductQuality',v_controls_product_quality,'specialCharacteristicImpact',v_special_characteristic_impact,'stopsProduction',v_stops_production,'hasBackup',v_has_backup,'capacityImpact',v_capacity_impact),
      'registeredBy',v_actor,'registeredAt',now()
    ))
  );

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_id,'Equipment',v_id,'CREATE_EQUIPMENT_AUTO_ID',v_actor,jsonb_build_object('equipmentType',v_type,'criticality',v_criticality,'criticalityRule','CEV-ABCD-V2'));

  return jsonb_build_object('equipmentId',v_id,'qrCode',v_id,'equipmentType',v_type,'equipmentName',v_name,'criticality',v_criticality,'criticalityRule','CEV-ABCD-V2');
end $$;

revoke all on function public.rpc_create_equipment_auto(jsonb) from public, anon;
grant execute on function public.rpc_create_equipment_auto(jsonb) to authenticated;

create or replace function public.rpc_update_equipment_details(p_equipment_id text, p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.equipment_master%rowtype;
  v_actor text;
  v_criticality text;
  v_controls boolean;
  v_special boolean;
  v_stops boolean;
  v_backup boolean;
  v_capacity boolean;
  v_source jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_old from public.equipment_master where equipment_id=trim(p_equipment_id) for update;
  if not found then raise exception 'EQUIPMENT_NOT_FOUND'; end if;

  v_controls:=(p_input->>'controlsProductQuality')::boolean;
  v_special:=(p_input->>'specialCharacteristicImpact')::boolean;
  v_stops:=(p_input->>'stopsProduction')::boolean;
  v_backup:=(p_input->>'hasBackup')::boolean;
  v_capacity:=(p_input->>'capacityImpact')::boolean;
  if v_controls is null or v_special is null or v_stops is null or v_backup is null or v_capacity is null then raise exception 'CRITICALITY_FACTS_REQUIRED'; end if;
  v_criticality:=case when v_special then 'A' when not v_backup and (v_controls or v_stops or v_capacity) then 'A' when v_controls or v_stops or v_capacity then 'B' when not v_backup then 'C' else 'D' end;

  v_source:=coalesce(v_old.source_data,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'equipmentCategory',nullif(trim(regexp_replace(coalesce(p_input->>'equipmentCategory',''),'\s+',' ','g')),''),
    'currentArea',nullif(trim(regexp_replace(coalesce(p_input->>'currentArea',''),'\s+',' ','g')),''),
    'currentLine',nullif(trim(regexp_replace(coalesce(p_input->>'currentLine',''),'\s+',' ','g')),''),
    'managingDepartment',nullif(trim(regexp_replace(coalesce(p_input->>'managingDepartment',''),'\s+',' ','g')),''),
    'usingDepartment',nullif(trim(regexp_replace(coalesce(p_input->>'department',''),'\s+',' ','g')),''),
    'technicalSpecification',nullif(trim(regexp_replace(coalesce(p_input->>'technicalSpecification',''),'\s+',' ','g')),''),
    'description',nullif(trim(regexp_replace(coalesce(p_input->>'description',''),'\s+',' ','g')),''),
    'accuracy',nullif(trim(regexp_replace(coalesce(p_input->>'accuracy',''),'\s+',' ','g')),''),
    'origin',nullif(trim(regexp_replace(coalesce(p_input->>'origin',''),'\s+',' ','g')),''),
    'manufactureDate',nullif(trim(p_input->>'manufactureDate'),''),
    'inServiceDate',nullif(trim(p_input->>'inServiceDate'),''),
    'warrantyUntil',nullif(trim(p_input->>'warrantyUntil'),''),
    'warrantyContact',nullif(trim(regexp_replace(coalesce(p_input->>'warrantyContact',''),'\s+',' ','g')),''),
    'note',nullif(trim(regexp_replace(coalesce(p_input->>'note',''),'\s+',' ','g')),''),
    'relatedDocuments',nullif(trim(regexp_replace(coalesce(p_input->>'relatedDocuments',''),'\s+',' ','g')),''),
    'criticality',v_criticality,'criticalityRule','CEV-ABCD-V2',
    'criticalityFacts',jsonb_build_object('controlsProductQuality',v_controls,'specialCharacteristicImpact',v_special,'stopsProduction',v_stops,'hasBackup',v_backup,'capacityImpact',v_capacity)
  ));

  update public.equipment_master set
    equipment_name=coalesce(nullif(trim(regexp_replace(coalesce(p_input->>'equipmentName',''),'\s+',' ','g')),''),v_old.equipment_name),
    manufacturer=nullif(trim(regexp_replace(coalesce(p_input->>'manufacturer',''),'\s+',' ','g')),''),
    model=nullif(trim(regexp_replace(coalesce(p_input->>'model',''),'\s+',' ','g')),''),
    serial_number=nullif(trim(regexp_replace(coalesce(p_input->>'serialNumber',''),'\s+',' ','g')),''),
    department=nullif(trim(regexp_replace(coalesce(p_input->>'department',''),'\s+',' ','g')),''),
    status=coalesce(nullif(trim(p_input->>'status'),''),v_old.status),qr_code=v_old.equipment_id,source_data=v_source,updated_at=now()
  where equipment_id=v_old.equipment_id;

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_old.equipment_id,'Equipment_Master',v_old.equipment_id,'UPDATE_DETAILS',v_actor,jsonb_build_object('before',v_old.source_data,'after',v_source));
  return jsonb_build_object('equipmentId',v_old.equipment_id,'criticality',v_criticality);
end $$;

grant execute on function public.rpc_update_equipment_details(text,jsonb) to authenticated;
