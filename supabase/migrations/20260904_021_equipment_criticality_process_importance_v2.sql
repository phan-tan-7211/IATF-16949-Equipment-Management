-- Refine equipment A/B/C/D classification to process criticality.
-- Rule version: CEV-ABCD-V2.
-- Criticality describes the equipment's importance to product quality, special characteristics,
-- production continuity and required output. It is not the severity of one breakdown event.

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
  v_rule text;
  v_facts jsonb;

  -- V2 process-criticality facts.
  v_controls_product_quality boolean;
  v_special_characteristic_impact boolean;
  v_stops_production boolean;
  v_has_backup boolean;
  v_capacity_impact boolean;
  v_has_v2_facts boolean;

  -- Temporary V1 compatibility during rollout.
  v_quality_impact boolean;
  v_safety_impact boolean;
  v_recovery_time text;
  v_has_v1_facts boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'EQUIPMENT_CREATE_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_type:=upper(trim(coalesce(p_input->>'equipmentType','PRODUCTION')))::public.equipment_type;
  v_name:=trim(coalesce(p_input->>'equipmentName',''));
  if v_name='' then raise exception 'EQUIPMENT_NAME_REQUIRED'; end if;

  v_controls_product_quality:=nullif(p_input->>'controlsProductQuality','')::boolean;
  v_special_characteristic_impact:=nullif(p_input->>'specialCharacteristicImpact','')::boolean;
  v_stops_production:=nullif(p_input->>'stopsProduction','')::boolean;
  v_has_backup:=nullif(p_input->>'hasBackup','')::boolean;
  v_capacity_impact:=nullif(p_input->>'capacityImpact','')::boolean;

  v_has_v2_facts := v_controls_product_quality is not null
    and v_special_characteristic_impact is not null
    and v_stops_production is not null
    and v_has_backup is not null
    and v_capacity_impact is not null;

  if v_has_v2_facts then
    v_rule:='CEV-ABCD-V2';
    if v_special_characteristic_impact then
      v_criticality:='A';
    elsif not v_has_backup and (v_controls_product_quality or v_stops_production or v_capacity_impact) then
      v_criticality:='A';
    elsif v_controls_product_quality or v_stops_production or v_capacity_impact then
      v_criticality:='B';
    elsif not v_has_backup then
      v_criticality:='C';
    else
      v_criticality:='D';
    end if;

    v_facts:=jsonb_build_object(
      'controlsProductQuality',v_controls_product_quality,
      'specialCharacteristicImpact',v_special_characteristic_impact,
      'stopsProduction',v_stops_production,
      'hasBackup',v_has_backup,
      'capacityImpact',v_capacity_impact
    );
  else
    -- V1 compatibility for already-open clients during rollout.
    v_quality_impact:=nullif(p_input->>'qualityImpact','')::boolean;
    v_safety_impact:=nullif(p_input->>'safetyImpact','')::boolean;
    v_recovery_time:=upper(trim(coalesce(p_input->>'recoveryTime','')));
    v_has_v1_facts := v_stops_production is not null
      and v_quality_impact is not null
      and v_safety_impact is not null
      and v_has_backup is not null
      and v_recovery_time in ('SHORT','MEDIUM','LONG');

    if v_has_v1_facts then
      v_rule:='CEV-ABCD-V1-LEGACY';
      if v_safety_impact or v_quality_impact then
        v_criticality:='A';
      elsif v_stops_production and (not v_has_backup or v_recovery_time='LONG') then
        v_criticality:='A';
      elsif v_stops_production then
        v_criticality:='B';
      elsif not v_has_backup and v_recovery_time='LONG' then
        v_criticality:='B';
      elsif not v_has_backup or v_recovery_time in ('MEDIUM','LONG') then
        v_criticality:='C';
      else
        v_criticality:='D';
      end if;
      v_facts:=jsonb_build_object(
        'stopsProduction',v_stops_production,
        'qualityImpact',v_quality_impact,
        'safetyImpact',v_safety_impact,
        'hasBackup',v_has_backup,
        'recoveryTime',v_recovery_time
      );
    else
      -- Temporary compatibility for the original manual registration UI.
      v_criticality:=upper(trim(coalesce(p_input->>'criticality','')));
      if v_criticality='' or v_criticality not in ('A','B','C','D') then
        raise exception 'EQUIPMENT_CRITICALITY_FACTS_REQUIRED';
      end if;
      v_rule:='LEGACY_MANUAL';
      v_facts:=null;
    end if;
  end if;

  v_id:=public.next_equipment_id(v_type);

  insert into public.equipment_master(
    equipment_id,equipment_type,qr_code,equipment_name,model,manufacturer,serial_number,department,status,active,source_data
  ) values (
    v_id,v_type,v_id,v_name,
    nullif(trim(coalesce(p_input->>'model','')),''),nullif(trim(coalesce(p_input->>'manufacturer','')),''),
    nullif(trim(coalesce(p_input->>'serialNumber','')),''),nullif(trim(coalesce(p_input->>'department','')),''),
    coalesce(nullif(trim(coalesce(p_input->>'status','')),''),'RUNNING'),true,
    jsonb_strip_nulls(jsonb_build_object(
      'criticality',v_criticality,
      'criticalityRule',v_rule,
      'criticalityFacts',v_facts,
      'equipmentCategory',nullif(trim(coalesce(p_input->>'equipmentCategory','')),''),
      'currentArea',nullif(trim(coalesce(p_input->>'currentArea','')),''),
      'currentLine',nullif(trim(coalesce(p_input->>'currentLine','')),''),
      'managingDepartment',nullif(trim(coalesce(p_input->>'managingDepartment','')),''),
      'usingDepartment',nullif(trim(coalesce(p_input->>'department','')),''),
      'technicalSpecification',nullif(trim(coalesce(p_input->>'technicalSpecification','')),''),
      'registeredBy',v_actor,
      'registeredAt',now()
    ))
  );

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_id,'Equipment',v_id,'CREATE_EQUIPMENT_AUTO_ID',v_actor,
    jsonb_strip_nulls(jsonb_build_object(
      'equipmentType',v_type,
      'criticality',v_criticality,
      'criticalityRule',v_rule,
      'criticalityFacts',v_facts
    )));

  return jsonb_build_object(
    'equipmentId',v_id,
    'qrCode',v_id,
    'equipmentType',v_type,
    'equipmentName',v_name,
    'criticality',v_criticality,
    'criticalityRule',v_rule
  );
end $$;

revoke all on function public.rpc_create_equipment_auto(jsonb) from public, anon;
grant execute on function public.rpc_create_equipment_auto(jsonb) to authenticated;
