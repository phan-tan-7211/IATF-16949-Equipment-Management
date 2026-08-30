create or replace function public.rpc_evaluate_calibration(p_calibration_log_id text,p_evaluation_result text,p_evaluation_note text default '')
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_log public.calibration_log%rowtype;
  v_result text;
  v_note text;
  v_at timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('QUALITY','MANAGER','ADMIN') then raise exception 'CALIBRATION_EVALUATION_ROLE_DENIED'; end if;

  select * into v_log from public.calibration_log where calibration_log_id=trim(coalesce(p_calibration_log_id,'')) for update;
  if not found then raise exception 'CALIBRATION_LOG_NOT_FOUND'; end if;
  if coalesce(v_log.source_data->>'evaluationResult','')<>'' then raise exception 'CALIBRATION_ALREADY_EVALUATED'; end if;

  v_result:=upper(trim(coalesce(p_evaluation_result,'')));
  v_note:=trim(coalesce(p_evaluation_note,''));
  if v_result not in ('PASS','FAIL','LIMITED_USE') then raise exception 'CALIBRATION_EVALUATION_RESULT_INVALID'; end if;
  if v_result<>'PASS' and v_note='' then raise exception 'CALIBRATION_EVALUATION_NOTE_REQUIRED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  update public.calibration_log set source_data=source_data||jsonb_build_object('evaluationResult',v_result,'evaluationNote',v_note,'evaluatedBy',v_actor,'evaluatedAt',v_at) where calibration_log_id=v_log.calibration_log_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_log.equipment_id,'CALIBRATION',v_log.calibration_log_id,'EVALUATE_CALIBRATION',v_actor,
    jsonb_build_object('calibrationResult',v_log.result,'evaluationResult',v_result,'evaluationNote',v_note,'evaluatedAt',v_at));

  return jsonb_build_object('calibrationLogId',v_log.calibration_log_id,'equipmentId',v_log.equipment_id,'evaluationResult',v_result,'evaluatedBy',v_actor,'evaluatedAt',v_at);
end $$;

grant execute on function public.rpc_evaluate_calibration(text,text,text) to authenticated;
