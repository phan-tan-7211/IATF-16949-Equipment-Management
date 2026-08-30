create or replace function public.rpc_record_calibration(
  p_equipment_id text,
  p_calibration_date date,
  p_next_due_date date,
  p_result text,
  p_provider text default '',
  p_certificate_path text default '',
  p_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_log_id text;
begin
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('QUALITY','MANAGER','ADMIN') then
    raise exception 'CALIBRATION_WRITE_NOT_ALLOWED';
  end if;
  if coalesce(trim(p_equipment_id),'') = '' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if p_next_due_date < p_calibration_date then raise exception 'NEXT_DUE_BEFORE_CALIBRATION_DATE'; end if;
  if upper(trim(p_result)) not in ('PASS','FAIL','LIMITED_USE') then raise exception 'INVALID_CALIBRATION_RESULT'; end if;
  if not exists (select 1 from public.equipment_master where equipment_id=p_equipment_id and equipment_type='MEASUREMENT') then raise exception 'MEASUREMENT_EQUIPMENT_REQUIRED'; end if;

  v_actor := coalesce(auth.jwt()->>'email','unknown');
  v_log_id := 'CAL-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text),1,6);

  insert into public.calibration_log(calibration_log_id,equipment_id,calibration_date,next_due_date,result,actor_email,source_data)
  values(v_log_id,p_equipment_id,p_calibration_date,p_next_due_date,upper(trim(p_result)),v_actor,jsonb_build_object('provider',trim(p_provider),'certificatePath',trim(p_certificate_path),'note',trim(p_note)));

  update public.calibration_master
  set last_calibration_date=p_calibration_date,next_due_date=p_next_due_date,status=case when upper(trim(p_result))='FAIL' then 'HOLD' else 'ACTIVE' end,updated_at=now()
  where equipment_id=p_equipment_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text),1,6),p_equipment_id,'Calibration_Log',v_log_id,'RECORD_CALIBRATION',v_actor,jsonb_build_object('calibrationDate',p_calibration_date,'nextDueDate',p_next_due_date,'result',upper(trim(p_result)),'provider',trim(p_provider),'certificatePath',trim(p_certificate_path)));

  return jsonb_build_object('calibrationLogId',v_log_id,'equipmentId',p_equipment_id,'result',upper(trim(p_result)));
end;
$$;

revoke all on function public.rpc_record_calibration(text,date,date,text,text,text,text) from public;
grant execute on function public.rpc_record_calibration(text,date,date,text,text,text,text) to authenticated;
