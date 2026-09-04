-- Spreadsheet-style row batch update for Equipment Master.
-- One RPC accepts different patches per equipment row and audits each changed record.

create or replace function public.rpc_bulk_update_equipment_rows(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor text;
  v_change jsonb;
  v_patch jsonb;
  v_id text;
  v_old public.equipment_master%rowtype;
  v_source jsonb;
  v_facts jsonb;
  v_status text;
  v_label_size text;
  v_updated int := 0;
  v_controls boolean;
  v_special boolean;
  v_stops boolean;
  v_backup boolean;
  v_capacity boolean;
  v_criticality text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes)=0 then raise exception 'CHANGES_REQUIRED'; end if;
  if jsonb_array_length(p_changes) > 500 then raise exception 'TOO_MANY_CHANGES'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  for v_change in select value from jsonb_array_elements(p_changes) loop
    v_id:=upper(trim(coalesce(v_change->>'equipmentId','')));
    if v_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
    v_patch:=v_change-'equipmentId';
    if v_patch='{}'::jsonb then continue; end if;
    if exists(
      select 1 from jsonb_object_keys(v_patch) k
      where k not in (
        'equipmentName','equipmentCategory','manufacturer','distributor','model','serialNumber','department','managingDepartment',
        'managementResponsiblePrimary','managementResponsibleSecondary','currentArea','currentLine','status','defaultLabelSize',
        'technicalSpecification','description','accuracy','controlsProductQuality','specialCharacteristicImpact','stopsProduction','hasBackup','capacityImpact',
        'origin','manufactureDate','inServiceDate','warrantyUntil','warrantyContact','note','relatedDocuments','active'
      )
    ) then raise exception 'ROW_FIELD_NOT_ALLOWED'; end if;

    select * into v_old from public.equipment_master where equipment_id=v_id for update;
    if not found then continue; end if;
    v_source:=coalesce(v_old.source_data,'{}'::jsonb);

    if v_patch ? 'status' then
      v_status:=upper(trim(coalesce(v_patch->>'status','')));
      if v_status not in ('RUNNING','DOWN','MAINTENANCE','STOPPED','DISPOSED','UNKNOWN') then raise exception 'INVALID_STATUS'; end if;
    end if;
    if v_patch ? 'defaultLabelSize' then
      v_label_size:=trim(coalesce(v_patch->>'defaultLabelSize',''));
      if v_label_size not in ('tiny','standard','large') then raise exception 'INVALID_LABEL_SIZE'; end if;
    end if;

    -- Text fields stored in source_data.
    if v_patch ? 'equipmentCategory' then v_source:=case when trim(coalesce(v_patch->>'equipmentCategory',''))='' then v_source-'equipmentCategory' else jsonb_set(v_source,'{equipmentCategory}',to_jsonb(trim(regexp_replace(v_patch->>'equipmentCategory','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'distributor' then v_source:=case when trim(coalesce(v_patch->>'distributor',''))='' then v_source-'distributor' else jsonb_set(v_source,'{distributor}',to_jsonb(trim(regexp_replace(v_patch->>'distributor','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'department' then v_source:=case when trim(coalesce(v_patch->>'department',''))='' then v_source-'usingDepartment' else jsonb_set(v_source,'{usingDepartment}',to_jsonb(trim(regexp_replace(v_patch->>'department','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'managingDepartment' then v_source:=case when trim(coalesce(v_patch->>'managingDepartment',''))='' then v_source-'managingDepartment' else jsonb_set(v_source,'{managingDepartment}',to_jsonb(trim(regexp_replace(v_patch->>'managingDepartment','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'managementResponsiblePrimary' then v_source:=case when trim(coalesce(v_patch->>'managementResponsiblePrimary',''))='' then v_source-'managementResponsiblePrimary' else jsonb_set(v_source,'{managementResponsiblePrimary}',to_jsonb(trim(regexp_replace(v_patch->>'managementResponsiblePrimary','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'managementResponsibleSecondary' then v_source:=case when trim(coalesce(v_patch->>'managementResponsibleSecondary',''))='' then v_source-'managementResponsibleSecondary' else jsonb_set(v_source,'{managementResponsibleSecondary}',to_jsonb(trim(regexp_replace(v_patch->>'managementResponsibleSecondary','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'currentArea' then v_source:=case when trim(coalesce(v_patch->>'currentArea',''))='' then v_source-'currentArea' else jsonb_set(v_source,'{currentArea}',to_jsonb(trim(regexp_replace(v_patch->>'currentArea','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'currentLine' then v_source:=case when trim(coalesce(v_patch->>'currentLine',''))='' then v_source-'currentLine' else jsonb_set(v_source,'{currentLine}',to_jsonb(trim(regexp_replace(v_patch->>'currentLine','\s+',' ','g'))),true) end; end if;
    if v_patch ? 'technicalSpecification' then v_source:=case when trim(coalesce(v_patch->>'technicalSpecification',''))='' then v_source-'technicalSpecification' else jsonb_set(v_source,'{technicalSpecification}',to_jsonb(trim(v_patch->>'technicalSpecification')),true) end; end if;
    if v_patch ? 'description' then v_source:=case when trim(coalesce(v_patch->>'description',''))='' then v_source-'description' else jsonb_set(v_source,'{description}',to_jsonb(trim(v_patch->>'description')),true) end; end if;
    if v_patch ? 'accuracy' then v_source:=case when trim(coalesce(v_patch->>'accuracy',''))='' then v_source-'accuracy' else jsonb_set(v_source,'{accuracy}',to_jsonb(trim(v_patch->>'accuracy')),true) end; end if;
    if v_patch ? 'origin' then v_source:=case when trim(coalesce(v_patch->>'origin',''))='' then v_source-'origin' else jsonb_set(v_source,'{origin}',to_jsonb(trim(v_patch->>'origin')),true) end; end if;
    if v_patch ? 'manufactureDate' then v_source:=case when trim(coalesce(v_patch->>'manufactureDate',''))='' then v_source-'manufactureDate' else jsonb_set(v_source,'{manufactureDate}',to_jsonb(trim(v_patch->>'manufactureDate')),true) end; end if;
    if v_patch ? 'inServiceDate' then v_source:=case when trim(coalesce(v_patch->>'inServiceDate',''))='' then v_source-'inServiceDate' else jsonb_set(v_source,'{inServiceDate}',to_jsonb(trim(v_patch->>'inServiceDate')),true) end; end if;
    if v_patch ? 'warrantyUntil' then v_source:=case when trim(coalesce(v_patch->>'warrantyUntil',''))='' then v_source-'warrantyUntil' else jsonb_set(v_source,'{warrantyUntil}',to_jsonb(trim(v_patch->>'warrantyUntil')),true) end; end if;
    if v_patch ? 'warrantyContact' then v_source:=case when trim(coalesce(v_patch->>'warrantyContact',''))='' then v_source-'warrantyContact' else jsonb_set(v_source,'{warrantyContact}',to_jsonb(trim(v_patch->>'warrantyContact')),true) end; end if;
    if v_patch ? 'note' then v_source:=case when trim(coalesce(v_patch->>'note',''))='' then v_source-'note' else jsonb_set(v_source,'{note}',to_jsonb(trim(v_patch->>'note')),true) end; end if;
    if v_patch ? 'relatedDocuments' then v_source:=case when trim(coalesce(v_patch->>'relatedDocuments',''))='' then v_source-'relatedDocuments' else jsonb_set(v_source,'{relatedDocuments}',to_jsonb(trim(v_patch->>'relatedDocuments')),true) end; end if;
    if v_patch ? 'defaultLabelSize' then v_source:=jsonb_set(v_source,'{defaultLabelSize}',to_jsonb(v_label_size),true); end if;

    -- Criticality facts remain formula-driven. Edit facts, then derive A/B/C/D when all five are known.
    v_facts:=coalesce(v_source->'criticalityFacts','{}'::jsonb);
    if v_patch ? 'controlsProductQuality' then v_facts:=jsonb_set(v_facts,'{controlsProductQuality}',to_jsonb((v_patch->>'controlsProductQuality')::boolean),true); end if;
    if v_patch ? 'specialCharacteristicImpact' then v_facts:=jsonb_set(v_facts,'{specialCharacteristicImpact}',to_jsonb((v_patch->>'specialCharacteristicImpact')::boolean),true); end if;
    if v_patch ? 'stopsProduction' then v_facts:=jsonb_set(v_facts,'{stopsProduction}',to_jsonb((v_patch->>'stopsProduction')::boolean),true); end if;
    if v_patch ? 'hasBackup' then v_facts:=jsonb_set(v_facts,'{hasBackup}',to_jsonb((v_patch->>'hasBackup')::boolean),true); end if;
    if v_patch ? 'capacityImpact' then v_facts:=jsonb_set(v_facts,'{capacityImpact}',to_jsonb((v_patch->>'capacityImpact')::boolean),true); end if;
    if v_patch ? 'controlsProductQuality' or v_patch ? 'specialCharacteristicImpact' or v_patch ? 'stopsProduction' or v_patch ? 'hasBackup' or v_patch ? 'capacityImpact' then
      v_source:=jsonb_set(v_source,'{criticalityFacts}',v_facts,true);
      if v_facts ? 'controlsProductQuality' and v_facts ? 'specialCharacteristicImpact' and v_facts ? 'stopsProduction' and v_facts ? 'hasBackup' and v_facts ? 'capacityImpact' then
        v_controls:=(v_facts->>'controlsProductQuality')::boolean;
        v_special:=(v_facts->>'specialCharacteristicImpact')::boolean;
        v_stops:=(v_facts->>'stopsProduction')::boolean;
        v_backup:=(v_facts->>'hasBackup')::boolean;
        v_capacity:=(v_facts->>'capacityImpact')::boolean;
        v_criticality:=case when v_special then 'A' when not v_backup and (v_controls or v_stops or v_capacity) then 'A' when v_controls or v_stops or v_capacity then 'B' when not v_backup then 'C' else 'D' end;
        v_source:=jsonb_set(v_source,'{criticality}',to_jsonb(v_criticality),true);
        v_source:=jsonb_set(v_source,'{criticalityRule}',to_jsonb('CEV-ABCD-V2'::text),true);
      end if;
    end if;

    update public.equipment_master set
      equipment_name=case when v_patch ? 'equipmentName' then coalesce(nullif(trim(regexp_replace(coalesce(v_patch->>'equipmentName',''),'\s+',' ','g')),''),equipment_name) else equipment_name end,
      manufacturer=case when v_patch ? 'manufacturer' then nullif(trim(regexp_replace(coalesce(v_patch->>'manufacturer',''),'\s+',' ','g')),'') else manufacturer end,
      model=case when v_patch ? 'model' then nullif(trim(regexp_replace(coalesce(v_patch->>'model',''),'\s+',' ','g')),'') else model end,
      serial_number=case when v_patch ? 'serialNumber' then nullif(trim(regexp_replace(coalesce(v_patch->>'serialNumber',''),'\s+',' ','g')),'') else serial_number end,
      department=case when v_patch ? 'department' then nullif(trim(regexp_replace(coalesce(v_patch->>'department',''),'\s+',' ','g')),'') else department end,
      status=case when v_patch ? 'status' then v_status else status end,
      active=case when v_patch ? 'active' then (v_patch->>'active')::boolean else active end,
      source_data=v_source,
      updated_at=now()
    where equipment_id=v_old.equipment_id;

    insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
    values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_old.equipment_id,'Equipment_Master',v_old.equipment_id,'SPREADSHEET_ROW_UPDATE',v_actor,jsonb_build_object('patch',v_patch));
    v_updated:=v_updated+1;
  end loop;

  return jsonb_build_object('updatedCount',v_updated);
end $$;

revoke all on function public.rpc_bulk_update_equipment_rows(jsonb) from public, anon;
grant execute on function public.rpc_bulk_update_equipment_rows(jsonb) to authenticated;
