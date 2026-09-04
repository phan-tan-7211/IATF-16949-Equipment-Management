-- Fix production schema mismatch: equipment_master.status is TEXT, not public.equipment_status.
-- Keep the same validated status values without casting to a non-existent enum.

create or replace function public.rpc_bulk_update_equipment_master(p_equipment_ids text[], p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor text;
  v_id text;
  v_old public.equipment_master%rowtype;
  v_source jsonb;
  v_updated int := 0;
  v_status text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if coalesce(array_length(p_equipment_ids,1),0)=0 then raise exception 'EQUIPMENT_IDS_REQUIRED'; end if;
  if p_patch is null or p_patch='{}'::jsonb then raise exception 'PATCH_REQUIRED'; end if;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('department','managingDepartment','currentArea','currentLine','equipmentCategory','status')) then
    raise exception 'BULK_FIELD_NOT_ALLOWED';
  end if;
  if p_patch ? 'status' then
    v_status:=upper(trim(coalesce(p_patch->>'status','')));
    if v_status not in ('RUNNING','DOWN','MAINTENANCE','STOPPED','DISPOSED','UNKNOWN') then raise exception 'INVALID_STATUS'; end if;
  end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  foreach v_id in array p_equipment_ids loop
    select * into v_old from public.equipment_master where equipment_id=upper(trim(v_id)) for update;
    if not found then continue; end if;

    v_source:=coalesce(v_old.source_data,'{}'::jsonb);
    if p_patch ? 'department' then
      v_source:=jsonb_set(v_source,'{usingDepartment}',to_jsonb(nullif(trim(regexp_replace(coalesce(p_patch->>'department',''),'\s+',' ','g')),'')),true);
    end if;
    if p_patch ? 'managingDepartment' then
      v_source:=jsonb_set(v_source,'{managingDepartment}',to_jsonb(nullif(trim(regexp_replace(coalesce(p_patch->>'managingDepartment',''),'\s+',' ','g')),'')),true);
    end if;
    if p_patch ? 'currentArea' then
      v_source:=jsonb_set(v_source,'{currentArea}',to_jsonb(nullif(trim(regexp_replace(coalesce(p_patch->>'currentArea',''),'\s+',' ','g')),'')),true);
    end if;
    if p_patch ? 'currentLine' then
      v_source:=jsonb_set(v_source,'{currentLine}',to_jsonb(nullif(trim(regexp_replace(coalesce(p_patch->>'currentLine',''),'\s+',' ','g')),'')),true);
    end if;
    if p_patch ? 'equipmentCategory' then
      v_source:=jsonb_set(v_source,'{equipmentCategory}',to_jsonb(nullif(trim(regexp_replace(coalesce(p_patch->>'equipmentCategory',''),'\s+',' ','g')),'')),true);
    end if;

    update public.equipment_master set
      department=case when p_patch ? 'department' then nullif(trim(regexp_replace(coalesce(p_patch->>'department',''),'\s+',' ','g')),'') else department end,
      status=case when p_patch ? 'status' then v_status else status end,
      source_data=v_source,
      updated_at=now()
    where equipment_id=v_old.equipment_id;

    insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
    values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_old.equipment_id,'Equipment_Master',v_old.equipment_id,'BULK_UPDATE',v_actor,jsonb_build_object('patch',p_patch));
    v_updated:=v_updated+1;
  end loop;

  return jsonb_build_object('updatedCount',v_updated);
end $$;

revoke all on function public.rpc_bulk_update_equipment_master(text[],jsonb) from public, anon;
grant execute on function public.rpc_bulk_update_equipment_master(text[],jsonb) to authenticated;
