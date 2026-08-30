create or replace function public.rpc_record_calibration_vendor_quote(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_calibration_id text;
  v_equipment_id text;
  v_provider text;
  v_amount bigint;
  v_source_date date;
  v_source_document text;
  v_quote_id text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('QUALITY','MANAGER','ADMIN') then raise exception 'CALIBRATION_QUOTE_ROLE_DENIED'; end if;
  v_calibration_id:=trim(coalesce(p_input->>'calibrationEquipmentId',''));
  select equipment_id into v_equipment_id from public.calibration_master where calibration_id=v_calibration_id;
  if not found then raise exception 'CALIBRATION_MASTER_NOT_FOUND'; end if;
  v_provider:=trim(coalesce(p_input->>'provider',''));
  v_source_document:=trim(coalesce(p_input->>'sourceDocument',''));
  if v_provider='' then raise exception 'QUOTE_PROVIDER_REQUIRED'; end if;
  if v_source_document='' then raise exception 'QUOTE_SOURCE_DOCUMENT_REQUIRED'; end if;
  v_amount:=coalesce((p_input->>'amountVnd')::bigint,-1);
  if v_amount<0 then raise exception 'QUOTE_AMOUNT_INVALID'; end if;
  v_source_date:=(p_input->>'sourceDate')::date;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_quote_id:='CQ-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.calibration_vendor_quote(quote_id,equipment_id,source_data)
  values(v_quote_id,v_equipment_id,jsonb_build_object('calibrationEquipmentId',v_calibration_id,'provider',v_provider,'amountVnd',v_amount,'sourceDate',v_source_date,'sourceDocument',v_source_document,'recordedBy',v_actor,'recordedAt',now()));
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_equipment_id,'Calibration_Vendor_Quote',v_quote_id,'RECORD_QUOTE',v_actor,jsonb_build_object('provider',v_provider,'amountVnd',v_amount,'sourceDate',v_source_date,'sourceDocument',v_source_document));
  return jsonb_build_object('quoteId',v_quote_id,'equipmentId',v_equipment_id,'calibrationEquipmentId',v_calibration_id);
end $$;

grant execute on function public.rpc_record_calibration_vendor_quote(jsonb) to authenticated;
