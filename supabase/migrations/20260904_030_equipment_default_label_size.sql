-- Persist a default physical label stock size per equipment.
-- Allowed stock sizes: 15x25, 30x50, 45x80 mm.

create or replace function public.rpc_set_equipment_label_size(p_equipment_id text, p_label_size text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text := upper(trim(coalesce(p_equipment_id,'')));
  v_size text := lower(trim(coalesce(p_label_size,'')));
  v_role public.app_role;
  v_actor text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'EQUIPMENT_LABEL_SIZE_ROLE_DENIED'; end if;
  if v_id = '' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if v_size not in ('tiny','standard','large') then raise exception 'INVALID_EQUIPMENT_LABEL_SIZE'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_id) then raise exception 'EQUIPMENT_NOT_FOUND'; end if;

  v_actor := coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  update public.equipment_master
  set source_data = coalesce(source_data,'{}'::jsonb) || jsonb_build_object(
        'defaultLabelSize',v_size,
        'labelSizeUpdatedAt',now(),
        'labelSizeUpdatedBy',v_actor
      ),
      updated_at = now()
  where equipment_id=v_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_id,'Equipment_Master',v_id,'SET_DEFAULT_LABEL_SIZE',v_actor,
    jsonb_build_object('defaultLabelSize',v_size)
  );

  return jsonb_build_object('equipmentId',v_id,'defaultLabelSize',v_size);
end $$;

revoke all on function public.rpc_set_equipment_label_size(text,text) from public, anon;
grant execute on function public.rpc_set_equipment_label_size(text,text) to authenticated;
