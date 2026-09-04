-- Equipment distributor is distinct from manufacturer.
-- Stored in equipment_master.source_data so it remains part of the master record without duplicating the manufacturer column.

create or replace function public.rpc_set_equipment_distributor(p_equipment_id text, p_distributor text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_id text;
  v_distributor text;
  v_actor text;
  v_old_source jsonb;
  v_new_source jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'EQUIPMENT_EDIT_ROLE_DENIED'; end if;

  v_id:=upper(trim(coalesce(p_equipment_id,'')));
  if v_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  v_distributor:=trim(regexp_replace(coalesce(p_distributor,''),'\s+',' ','g'));

  select coalesce(source_data,'{}'::jsonb)
    into v_old_source
  from public.equipment_master
  where equipment_id=v_id
  for update;
  if not found then raise exception 'EQUIPMENT_NOT_FOUND'; end if;

  v_new_source:=(v_old_source - 'distributor') || jsonb_strip_nulls(
    jsonb_build_object('distributor',nullif(v_distributor,''))
  );

  update public.equipment_master
  set source_data=v_new_source,
      updated_at=now()
  where equipment_id=v_id;

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_id,'Equipment_Master',v_id,'SET_DISTRIBUTOR',v_actor,
    jsonb_build_object('before',v_old_source->>'distributor','after',nullif(v_distributor,''))
  );

  return jsonb_build_object('equipmentId',v_id,'distributor',nullif(v_distributor,''));
end $$;

revoke all on function public.rpc_set_equipment_distributor(text,text) from public, anon;
grant execute on function public.rpc_set_equipment_distributor(text,text) to authenticated;
