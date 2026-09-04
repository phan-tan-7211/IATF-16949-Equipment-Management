alter table public.equipment_inventory_result add column if not exists label_ok boolean;
update public.equipment_inventory_result set label_ok=true where status='FOUND_LABEL_OK' and label_ok is null;
update public.equipment_inventory_result set label_ok=false where status='FOUND_NO_LABEL' and label_ok is null;

create or replace function public.rpc_record_equipment_inventory(
  p_session_id text,
  p_equipment_id text,
  p_status text,
  p_actual_area text default '',
  p_actual_line text default '',
  p_note text default '',
  p_source text default 'MANUAL',
  p_label_ok boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor text;
  v_role text;
  v_status text;
  v_source text;
  v_session_status text;
  v_equipment_id text;
  v_label_ok boolean;
  v_result public.equipment_inventory_result%rowtype;
begin
  v_role:=coalesce(public.current_app_role()::text,'');
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'INVENTORY_ROLE_REQUIRED'; end if;
  v_status:=upper(trim(coalesce(p_status,'')));
  if v_status not in ('FOUND_LABEL_OK','FOUND_NO_LABEL','MOVED','NOT_FOUND','DATA_INVALID') then raise exception 'INVALID_INVENTORY_STATUS'; end if;
  v_source:=upper(trim(coalesce(p_source,'MANUAL')));
  if v_source not in ('QR','MANUAL') then raise exception 'INVALID_INVENTORY_SOURCE'; end if;
  v_equipment_id:=upper(trim(coalesce(p_equipment_id,'')));
  if v_equipment_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;

  select status into v_session_status from public.equipment_inventory_session where session_id=upper(trim(p_session_id));
  if not found then raise exception 'INVENTORY_SESSION_NOT_FOUND'; end if;
  if v_session_status<>'OPEN' then raise exception 'INVENTORY_SESSION_CLOSED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id and active=true) then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  if v_status='MOVED' and nullif(trim(coalesce(p_actual_area,'')),'') is null and nullif(trim(coalesce(p_actual_line,'')),'') is null then raise exception 'ACTUAL_LOCATION_REQUIRED'; end if;

  v_label_ok:=case when v_status='FOUND_LABEL_OK' then true when v_status='FOUND_NO_LABEL' then false when v_status='MOVED' then p_label_ok else null end;
  if v_status='MOVED' and v_label_ok is null then raise exception 'LABEL_STATE_REQUIRED'; end if;

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  insert into public.equipment_inventory_result(session_id,equipment_id,status,actual_area,actual_line,note,source,checked_at,checked_by,label_ok)
  values(
    upper(trim(p_session_id)),v_equipment_id,v_status,
    case when v_status='MOVED' then nullif(trim(coalesce(p_actual_area,'')),'') else null end,
    case when v_status='MOVED' then nullif(trim(coalesce(p_actual_line,'')),'') else null end,
    nullif(trim(coalesce(p_note,'')),''),v_source,now(),v_actor,v_label_ok
  )
  on conflict (session_id,equipment_id) do update set
    status=excluded.status,
    actual_area=excluded.actual_area,
    actual_line=excluded.actual_line,
    note=excluded.note,
    source=excluded.source,
    checked_at=excluded.checked_at,
    checked_by=excluded.checked_by,
    label_ok=excluded.label_ok;

  select * into v_result from public.equipment_inventory_result where session_id=upper(trim(p_session_id)) and equipment_id=v_equipment_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_equipment_id,'Equipment_Inventory',upper(trim(p_session_id)),'INVENTORY_CHECK',v_actor,jsonb_build_object('sessionId',upper(trim(p_session_id)),'equipmentId',v_equipment_id,'status',v_status,'source',v_source,'labelOk',v_result.label_ok,'actualArea',v_result.actual_area,'actualLine',v_result.actual_line,'note',v_result.note));

  return jsonb_build_object('sessionId',v_result.session_id,'equipmentId',v_result.equipment_id,'status',v_result.status,'labelOk',v_result.label_ok,'actualArea',coalesce(v_result.actual_area,''),'actualLine',coalesce(v_result.actual_line,''),'note',coalesce(v_result.note,''),'source',v_result.source,'checkedAt',v_result.checked_at,'checkedBy',v_result.checked_by);
end $$;

revoke all on function public.rpc_record_equipment_inventory(text,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.rpc_record_equipment_inventory(text,text,text,text,text,text,text,boolean) to authenticated;
