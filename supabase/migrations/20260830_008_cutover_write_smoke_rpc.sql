-- ADMIN-only write smoke for production cutover.
-- Calls the real workflow RPCs inside a PL/pgSQL exception subtransaction,
-- then deliberately raises SMOKE_ROLLBACK so every test write is rolled back.

create or replace function public.rpc_cutover_write_smoke()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_prod_id text;
  v_measurement_id text;
  v_token text;
  v_insp jsonb;
  v_wo_id text;
  v_tooling_id text;
  v_mod jsonb;
  v_mod_id text;
  v_inspection_ok boolean := false;
  v_maintenance_ok boolean := false;
  v_calibration_ok boolean := false;
  v_tooling_ok boolean := false;
  v_cleanup_ok boolean := false;
  v_error text := '';
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role is distinct from 'ADMIN' then raise exception 'ADMIN_REQUIRED'; end if;

  select equipment_id into v_prod_id
  from public.equipment_master
  where equipment_type='PRODUCTION' and active=true
  order by equipment_id
  limit 1;

  select equipment_id into v_measurement_id
  from public.equipment_master
  where equipment_type='MEASUREMENT' and active=true
  order by equipment_id
  limit 1;

  if v_prod_id is null then raise exception 'NO_PRODUCTION_EQUIPMENT_FOR_SMOKE'; end if;
  if v_measurement_id is null then raise exception 'NO_MEASUREMENT_EQUIPMENT_FOR_SMOKE'; end if;

  v_token := 'SMOKE-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_tooling_id := v_token || '-TOOL';

  begin
    -- 1) Inspection STOP_REPAIR: must atomically create inspection + WO + downtime.
    v_insp := public.rpc_submit_daily_inspection(
      v_token || '-INSP',
      v_prod_id,
      'MORNING',
      'CUTOVER_SMOKE',
      'STOP_REPAIR',
      'Cutover smoke rollback test',
      'SMOKE_PART',
      'CRITICAL'
    );
    v_wo_id := v_insp->>'workOrderId';

    v_inspection_ok :=
      coalesce(v_insp->>'inspectionId','') <> ''
      and coalesce(v_wo_id,'') <> ''
      and coalesce(v_insp->>'downtimeId','') <> ''
      and exists(select 1 from public.daily_inspection where inspection_id=v_insp->>'inspectionId')
      and exists(select 1 from public.maintenance_work_order where work_order_id=v_wo_id)
      and exists(select 1 from public.downtime_event where downtime_id=v_insp->>'downtimeId')
      and exists(select 1 from public.equipment_master where equipment_id=v_prod_id and status='DOWN');

    if not v_inspection_ok then raise exception 'SMOKE_INSPECTION_FAILED'; end if;

    -- 2) Maintenance workflow through VERIFIED using the WO created by Inspection.
    perform public.rpc_transition_maintenance(v_wo_id,'REQUEST_APPROVAL',v_token||'-REQ');
    perform public.rpc_transition_maintenance(v_wo_id,'APPROVE',v_token||'-APP');
    perform public.rpc_transition_maintenance(v_wo_id,'START',v_token||'-START');
    perform public.rpc_transition_maintenance(v_wo_id,'COMPLETE',v_token||'-DONE');
    perform public.rpc_transition_maintenance(v_wo_id,'VERIFY',v_token||'-VERIFY');
    v_maintenance_ok := exists(
      select 1 from public.maintenance_work_order
      where work_order_id=v_wo_id and status='VERIFIED'
    );
    if not v_maintenance_ok then raise exception 'SMOKE_MAINTENANCE_FAILED'; end if;

    -- 3) Calibration write using the real calibration RPC.
    perform public.rpc_record_calibration(
      v_measurement_id,
      current_date,
      current_date + 365,
      'PASS',
      'CUTOVER_SMOKE',
      '',
      v_token
    );
    v_calibration_ok := exists(
      select 1 from public.calibration_log
      where equipment_id=v_measurement_id
        and source_data->>'provider'='CUTOVER_SMOKE'
        and source_data->>'note'=v_token
    );
    if not v_calibration_ok then raise exception 'SMOKE_CALIBRATION_FAILED'; end if;

    -- 4) Tooling master + plan + modification full approval path.
    perform public.rpc_create_tooling(jsonb_build_object(
      'toolingId',v_tooling_id,
      'toolingType','JIG',
      'status','IN_PRODUCTION',
      'ownership','CEV',
      'smokeToken',v_token
    ));
    perform public.rpc_create_tooling_plan(jsonb_build_object(
      'toolingId',v_tooling_id,
      'frequencyType','MONTHLY',
      'smokeToken',v_token
    ));
    v_mod := public.rpc_create_tooling_modification(jsonb_build_object(
      'toolingId',v_tooling_id,
      'modificationType','SMOKE_TEST',
      'reason',v_token
    ));
    v_mod_id := v_mod->>'modificationId';
    perform public.rpc_transition_tooling_modification(v_mod_id,'APPROVE','');
    perform public.rpc_transition_tooling_modification(v_mod_id,'QA_CONFIRM','');
    perform public.rpc_transition_tooling_modification(v_mod_id,'COMPLETE','SMOKE_DOC');

    v_tooling_ok :=
      exists(select 1 from public.tooling_master where tooling_id=v_tooling_id)
      and exists(select 1 from public.tooling_maintenance_plan where tooling_id=v_tooling_id)
      and exists(select 1 from public.tooling_modification where modification_id=v_mod_id and status='COMPLETED');
    if not v_tooling_ok then raise exception 'SMOKE_TOOLING_FAILED'; end if;

    -- Deliberate rollback of every write made above.
    raise exception 'SMOKE_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'SMOKE_ROLLBACK' then
        v_error := sqlerrm;
      end if;
  end;

  -- Database changes inside the exception block have now been rolled back.
  v_cleanup_ok :=
    not exists(select 1 from public.tooling_master where tooling_id=v_tooling_id)
    and not exists(select 1 from public.calibration_log where source_data->>'note'=v_token)
    and not exists(select 1 from public.daily_inspection where source_data->>'operationId'=v_token||'-INSP');

  return jsonb_build_object(
    'pass', v_error='' and v_inspection_ok and v_maintenance_ok and v_calibration_ok and v_tooling_ok and v_cleanup_ok,
    'inspection', v_inspection_ok,
    'maintenance', v_maintenance_ok,
    'calibration', v_calibration_ok,
    'tooling', v_tooling_ok,
    'rollbackCleanup', v_cleanup_ok,
    'error', v_error,
    'productionEquipmentId', v_prod_id,
    'measurementEquipmentId', v_measurement_id
  );
end;
$$;

revoke all on function public.rpc_cutover_write_smoke() from public;
grant execute on function public.rpc_cutover_write_smoke() to authenticated;
