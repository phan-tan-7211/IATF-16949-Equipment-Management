-- Automatic IDs for lightweight flow-driven registration.
-- Existing canonical rules in production data:
--   Production equipment: CEV-PR-001...
--   Measurement equipment: CEV-ME-001...
--   Spare parts: SP-00001...

create sequence if not exists public.spare_part_id_seq;
create sequence if not exists public.production_equipment_id_seq;
create sequence if not exists public.measurement_equipment_id_seq;

do $$
declare
  v_sp bigint;
  v_pr bigint;
  v_me bigint;
begin
  select coalesce(max((regexp_match(part_id, '^SP-([0-9]+)$'))[1]::bigint), 0) into v_sp from public.spare_part_master;
  select coalesce(max((regexp_match(equipment_id, '^CEV-PR-([0-9]+)$'))[1]::bigint), 0) into v_pr from public.equipment_master;
  select coalesce(max((regexp_match(equipment_id, '^CEV-ME-([0-9]+)$'))[1]::bigint), 0) into v_me from public.equipment_master;
  perform setval('public.spare_part_id_seq', greatest(v_sp, 1), v_sp > 0);
  perform setval('public.production_equipment_id_seq', greatest(v_pr, 1), v_pr > 0);
  perform setval('public.measurement_equipment_id_seq', greatest(v_me, 1), v_me > 0);
end $$;

create or replace function public.next_spare_part_id()
returns text
language sql
volatile
set search_path=public
as $$
  select 'SP-' || lpad(nextval('public.spare_part_id_seq')::text, 5, '0')
$$;

create or replace function public.next_equipment_id(p_equipment_type public.equipment_type)
returns text
language plpgsql
volatile
set search_path=public
as $$
begin
  if p_equipment_type = 'PRODUCTION' then
    return 'CEV-PR-' || lpad(nextval('public.production_equipment_id_seq')::text, 3, '0');
  end if;
  return 'CEV-ME-' || lpad(nextval('public.measurement_equipment_id_seq')::text, 3, '0');
end $$;

-- Auto-generate part ID only for new parts. Existing partId still edits that record.
create or replace function public.rpc_save_spare_part(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_part_id text;
  v_part_name text;
  v_equipment_id text;
  v_is_new boolean;
  v_duplicate_id text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'SPARE_PART_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_part_id:=upper(trim(coalesce(p_input->>'partId','')));
  v_part_name:=trim(coalesce(p_input->>'partName',''));
  if v_part_name='' then raise exception 'PART_NAME_REQUIRED'; end if;

  v_is_new := v_part_id='';
  if v_is_new then
    if nullif(trim(coalesce(p_input->>'partNumber','')),'') is not null then
      select part_id into v_duplicate_id
      from public.spare_part_master
      where upper(coalesce(part_number,''))=upper(trim(p_input->>'partNumber'))
        and upper(coalesce(maker,''))=upper(trim(coalesce(p_input->>'maker','')))
        and active
      limit 1;
      if v_duplicate_id is not null then raise exception 'SPARE_PART_POSSIBLE_DUPLICATE:%', v_duplicate_id; end if;
    end if;
    v_part_id:=public.next_spare_part_id();
  elsif not exists(select 1 from public.spare_part_master where part_id=v_part_id) then
    raise exception 'SPARE_PART_EDIT_NOT_FOUND';
  end if;

  insert into public.spare_part_master(
    part_id,part_name,part_number,maker,stock_qty,min_qty,location,lead_time_days,
    stops_production,quality_safety_impact,lead_time_exceeds_recovery,rationale_note,active,created_by,updated_by
  ) values (
    v_part_id,v_part_name,nullif(trim(coalesce(p_input->>'partNumber','')),''),nullif(trim(coalesce(p_input->>'maker','')),''),
    greatest(coalesce((p_input->>'stockQty')::integer,0),0),greatest(coalesce((p_input->>'minQty')::integer,0),0),
    nullif(trim(coalesce(p_input->>'location','')),''),nullif(p_input->>'leadTimeDays','')::integer,
    coalesce((p_input->>'stopsProduction')::boolean,false),coalesce((p_input->>'qualitySafetyImpact')::boolean,false),
    coalesce((p_input->>'leadTimeExceedsRecovery')::boolean,false),nullif(trim(coalesce(p_input->>'rationaleNote','')),''),true,v_actor,v_actor
  )
  on conflict (part_id) do update set
    part_name=excluded.part_name,part_number=excluded.part_number,maker=excluded.maker,
    stock_qty=excluded.stock_qty,min_qty=excluded.min_qty,location=excluded.location,lead_time_days=excluded.lead_time_days,
    stops_production=excluded.stops_production,quality_safety_impact=excluded.quality_safety_impact,
    lead_time_exceeds_recovery=excluded.lead_time_exceeds_recovery,rationale_note=excluded.rationale_note,
    active=true,updated_by=v_actor,updated_at=now();

  delete from public.equipment_spare_part where part_id=v_part_id;
  for v_equipment_id in select jsonb_array_elements_text(coalesce(p_input->'equipmentIds','[]'::jsonb)) loop
    if exists(select 1 from public.equipment_master where equipment_id=v_equipment_id) then
      insert into public.equipment_spare_part(part_id,equipment_id) values(v_part_id,v_equipment_id) on conflict do nothing;
    end if;
  end loop;

  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    'Spare_Part',v_part_id,case when v_is_new then 'CREATE_SPARE_PART_AUTO_ID' else 'UPDATE_SPARE_PART' end,v_actor,
    jsonb_build_object('equipmentIds',coalesce(p_input->'equipmentIds','[]'::jsonb),'stockQty',coalesce((p_input->>'stockQty')::integer,0),'minQty',coalesce((p_input->>'minQty')::integer,0)));
  return (select to_jsonb(v) from public.spare_part_overview v where v.part_id=v_part_id);
end $$;

revoke all on function public.rpc_save_spare_part(jsonb) from public, anon;
grant execute on function public.rpc_save_spare_part(jsonb) to authenticated;

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
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'EQUIPMENT_CREATE_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_type:=upper(trim(coalesce(p_input->>'equipmentType','PRODUCTION')))::public.equipment_type;
  v_name:=trim(coalesce(p_input->>'equipmentName',''));
  if v_name='' then raise exception 'EQUIPMENT_NAME_REQUIRED'; end if;
  v_criticality:=upper(trim(coalesce(p_input->>'criticality','')));
  if v_criticality<>'' and v_criticality not in ('A','B','C','D') then raise exception 'EQUIPMENT_CRITICALITY_INVALID'; end if;
  v_id:=public.next_equipment_id(v_type);

  insert into public.equipment_master(
    equipment_id,equipment_type,qr_code,equipment_name,model,manufacturer,serial_number,department,status,active,source_data
  ) values (
    v_id,v_type,v_id,v_name,
    nullif(trim(coalesce(p_input->>'model','')),''),nullif(trim(coalesce(p_input->>'manufacturer','')),''),
    nullif(trim(coalesce(p_input->>'serialNumber','')),''),nullif(trim(coalesce(p_input->>'department','')),''),
    coalesce(nullif(trim(coalesce(p_input->>'status','')),''),'RUNNING'),true,
    jsonb_strip_nulls(jsonb_build_object(
      'criticality',nullif(v_criticality,''),
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
    v_id,'Equipment',v_id,'CREATE_EQUIPMENT_AUTO_ID',v_actor,jsonb_build_object('equipmentType',v_type,'criticality',v_criticality));
  return jsonb_build_object('equipmentId',v_id,'qrCode',v_id,'equipmentType',v_type,'equipmentName',v_name);
end $$;

revoke all on function public.rpc_create_equipment_auto(jsonb) from public, anon;
grant execute on function public.rpc_create_equipment_auto(jsonb) to authenticated;
