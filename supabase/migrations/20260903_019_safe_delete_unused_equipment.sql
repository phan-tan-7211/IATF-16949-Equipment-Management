-- Allow deleting newly created/demo equipment only when it has no operational traceability data.
-- Audit rows created by registration/edit are metadata and do not block deletion.

create or replace function public.rpc_check_equipment_delete(p_equipment_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_id text := upper(trim(coalesce(p_equipment_id,'')));
  v_exists boolean;
  v_blockers jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role <> 'ADMIN' then raise exception 'EQUIPMENT_DELETE_ROLE_DENIED'; end if;
  if v_id = '' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;

  select exists(select 1 from public.equipment_master where equipment_id=v_id) into v_exists;
  if not v_exists then
    return jsonb_build_object('exists',false,'canDelete',false,'equipmentId',v_id,'blockers','[]'::jsonb);
  end if;

  with counts(label, relation_name, row_count) as (
    select 'Kiểm tra hằng ngày','daily_inspection',count(*) from public.daily_inspection where equipment_id=v_id
    union all select 'Chi tiết kiểm tra','daily_inspection_item',count(*) from public.daily_inspection_item where equipment_id=v_id
    union all select 'Kế hoạch bảo trì','maintenance_plan',count(*) from public.maintenance_plan where equipment_id=v_id
    union all select 'Hạng mục kế hoạch bảo trì','maintenance_plan_item',count(*) from public.maintenance_plan_item where equipment_id=v_id
    union all select 'Work order bảo trì','maintenance_work_order',count(*) from public.maintenance_work_order where equipment_id=v_id
    union all select 'Thực hiện bảo trì','maintenance_execution',count(*) from public.maintenance_execution where equipment_id=v_id
    union all select 'Kết quả bảo trì','maintenance_result_item',count(*) from public.maintenance_result_item where equipment_id=v_id
    union all select 'Lịch sử bảo trì','maintenance_log',count(*) from public.maintenance_log where equipment_id=v_id
    union all select 'Downtime','downtime_event',count(*) from public.downtime_event where equipment_id=v_id
    union all select 'Bàn giao thiết bị','equipment_handover',count(*) from public.equipment_handover where equipment_id=v_id
    union all select 'Di chuyển thiết bị','equipment_movement_log',count(*) from public.equipment_movement_log where equipment_id=v_id
    union all select 'Master hiệu chuẩn','calibration_master',count(*) from public.calibration_master where equipment_id=v_id
    union all select 'Lịch sử hiệu chuẩn','calibration_log',count(*) from public.calibration_log where equipment_id=v_id
    union all select 'Báo giá hiệu chuẩn','calibration_vendor_quote',count(*) from public.calibration_vendor_quote where equipment_id=v_id
    union all select 'Tổng hợp báo giá hiệu chuẩn','calibration_quote_summary',count(*) from public.calibration_quote_summary where equipment_id=v_id
    union all select 'Liên kết phụ tùng','equipment_spare_part',count(*) from public.equipment_spare_part where equipment_id=v_id
    union all select 'Lịch sử dùng phụ tùng','spare_part_usage',count(*) from public.spare_part_usage where equipment_id=v_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('label',label,'relation',relation_name,'count',row_count) order by label)
    filter (where row_count > 0),'[]'::jsonb)
  into v_blockers
  from counts;

  return jsonb_build_object(
    'exists',true,
    'canDelete',jsonb_array_length(v_blockers)=0,
    'equipmentId',v_id,
    'blockers',v_blockers
  );
end $$;

create or replace function public.rpc_delete_unused_equipment(p_equipment_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_id text := upper(trim(coalesce(p_equipment_id,'')));
  v_check jsonb;
  v_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role <> 'ADMIN' then raise exception 'EQUIPMENT_DELETE_ROLE_DENIED'; end if;
  if v_id = '' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;

  v_check := public.rpc_check_equipment_delete(v_id);
  if not coalesce((v_check->>'exists')::boolean,false) then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  if not coalesce((v_check->>'canDelete')::boolean,false) then
    raise exception 'EQUIPMENT_HAS_RELATED_DATA:%', coalesce(v_check->'blockers','[]'::jsonb)::text;
  end if;

  select equipment_name into v_name from public.equipment_master where equipment_id=v_id for update;
  v_actor := coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  -- System audit metadata must not turn a brand-new/demo record into an undeletable record.
  delete from public.audit_log where equipment_id=v_id;
  delete from public.equipment_master where equipment_id=v_id;

  -- Keep a deletion audit event without an equipment FK so the deleted master can stay deleted.
  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    'Equipment',v_id,'DELETE_UNUSED_EQUIPMENT',v_actor,
    jsonb_build_object('equipmentName',coalesce(v_name,''),'reason','unused/demo equipment with no related operational data')
  );

  return jsonb_build_object('deleted',true,'equipmentId',v_id,'equipmentName',coalesce(v_name,''));
end $$;

revoke all on function public.rpc_check_equipment_delete(text) from public, anon;
revoke all on function public.rpc_delete_unused_equipment(text) from public, anon;
grant execute on function public.rpc_check_equipment_delete(text) to authenticated;
grant execute on function public.rpc_delete_unused_equipment(text) to authenticated;
