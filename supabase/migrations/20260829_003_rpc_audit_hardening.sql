-- Audit hardening for Supabase-only runtime.
-- Every core mutation below writes Audit_Log inside the same DB transaction.

create or replace function public.admin_update_equipment(p_old_equipment_id text, p_equipment_id text, p_equipment_type public.equipment_type, p_equipment_name text, p_model text, p_serial_number text, p_department text, p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_old public.equipment_master%rowtype;
  v_actor text;
  v_audit_id text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if coalesce(trim(p_old_equipment_id),'')='' or coalesce(trim(p_equipment_id),'')='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  select * into v_old from public.equipment_master where equipment_id=p_old_equipment_id for update;
  if not found then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_audit_id:='AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);

  if p_old_equipment_id=p_equipment_id then
    update public.equipment_master set equipment_type=p_equipment_type,equipment_name=p_equipment_name,model=p_model,serial_number=p_serial_number,department=p_department,status=p_status,qr_code=p_equipment_id,updated_at=now() where equipment_id=p_old_equipment_id;
    insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
    values(v_audit_id,p_equipment_id,'Equipment_Master',p_equipment_id,'UPDATE',v_actor,jsonb_build_object('before',jsonb_build_object('name',v_old.equipment_name,'model',v_old.model,'serial',v_old.serial_number,'department',v_old.department,'status',v_old.status),'after',jsonb_build_object('name',p_equipment_name,'model',p_model,'serial',p_serial_number,'department',p_department,'status',p_status)));
    return;
  end if;

  if exists(select 1 from public.equipment_master where equipment_id=p_equipment_id) then raise exception 'EQUIPMENT_ID_ALREADY_EXISTS'; end if;
  insert into public.equipment_master(equipment_id,equipment_type,control_number,qr_code,equipment_name,model,manufacturer,serial_number,department,status,active,source_data,created_at,updated_at)
  values(p_equipment_id,p_equipment_type,v_old.control_number,p_equipment_id,p_equipment_name,p_model,v_old.manufacturer,p_serial_number,p_department,p_status,v_old.active,v_old.source_data,v_old.created_at,now());

  update public.daily_inspection set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.daily_inspection_item set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.maintenance_plan set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.maintenance_plan_item set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.maintenance_work_order set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.maintenance_execution set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.maintenance_result_item set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.maintenance_log set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.equipment_handover set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.downtime_event set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.calibration_master set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.calibration_log set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.calibration_vendor_quote set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.calibration_quote_summary set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.equipment_movement_log set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  update public.audit_log set equipment_id=p_equipment_id where equipment_id=p_old_equipment_id;
  delete from public.equipment_master where equipment_id=p_old_equipment_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(v_audit_id,p_equipment_id,'Equipment_Master',p_equipment_id,'REKEY',v_actor,jsonb_build_object('oldEquipmentId',p_old_equipment_id,'newEquipmentId',p_equipment_id));
end $$;

grant execute on function public.admin_update_equipment(text,text,public.equipment_type,text,text,text,text,text) to authenticated;

create or replace function public.rpc_create_tooling(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id text; v_actor text; v_audit text; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  if v_role not in ('MANAGER','ADMIN') then raise exception 'TOOLING_MASTER_ROLE_DENIED'; end if;
  v_id:=trim(p_input->>'toolingId'); if v_id='' then raise exception 'TOOLING_ID_REQUIRED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text); v_audit:='AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.tooling_master(tooling_id,tooling_type,status,ownership,source_data) values(v_id,nullif(trim(p_input->>'toolingType'),''),coalesce(nullif(trim(p_input->>'status'),''),'IN_PRODUCTION'),nullif(trim(p_input->>'ownership'),''),p_input);
  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail) values(v_audit,'Tooling_Master',v_id,'CREATE',v_actor,p_input);
  return jsonb_build_object('toolingId',v_id);
end $$;

create or replace function public.rpc_create_tooling_plan(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id text; v_actor text; v_audit text; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'TOOLING_PLAN_ROLE_DENIED'; end if;
  v_id:='TPL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6); v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text); v_audit:='AUD-'||v_id;
  insert into public.tooling_maintenance_plan(tooling_plan_id,tooling_id,frequency_type,source_data) values(v_id,trim(p_input->>'toolingId'),nullif(trim(p_input->>'frequencyType'),''),p_input);
  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail) values(v_audit,'Tooling_Maintenance_Plan',v_id,'CREATE',v_actor,p_input);
  return jsonb_build_object('toolingPlanId',v_id);
end $$;

create or replace function public.rpc_create_tooling_modification(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id text; v_actor text; v_source jsonb; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'TOOLING_MOD_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text); v_id:='TMOD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6); v_source:=p_input||jsonb_build_object('proposedBy',v_actor);
  insert into public.tooling_modification(modification_id,tooling_id,modification_type,status,source_data) values(v_id,trim(p_input->>'toolingId'),nullif(trim(p_input->>'modificationType'),''),'PROPOSED',v_source);
  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail) values('AUD-'||v_id,'Tooling_Modification',v_id,'CREATE',v_actor,v_source);
  return jsonb_build_object('modificationId',v_id,'status','PROPOSED');
end $$;

create or replace function public.rpc_transition_tooling_modification(p_modification_id text,p_action text,p_updated_documents text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_actor text; v_row public.tooling_modification%rowtype; v_source jsonb; v_status text; v_audit text; begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role();
  select * into v_row from public.tooling_modification where modification_id=p_modification_id for update; if not found then raise exception 'MODIFICATION_NOT_FOUND'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text); v_source:=coalesce(v_row.source_data,'{}'::jsonb); v_status:=v_row.status;
  if p_action='APPROVE' then if v_role not in ('MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; if v_status<>'PROPOSED' then raise exception 'INVALID_TRANSITION'; end if; v_source:=v_source||jsonb_build_object('approvedBy',v_actor,'approvedAt',now()); v_status:='APPROVED';
  elsif p_action='QA_CONFIRM' then if v_role not in ('QUALITY','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; if v_status not in ('PROPOSED','APPROVED') then raise exception 'INVALID_TRANSITION'; end if; v_source:=v_source||jsonb_build_object('qaConfirmedBy',v_actor,'qaConfirmedAt',now()); v_status:='QA_CONFIRMED';
  elsif p_action='COMPLETE' then if v_role not in ('MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; if coalesce(v_source->>'approvedBy','')='' or coalesce(v_source->>'qaConfirmedBy','')='' then raise exception 'APPROVAL_AND_QA_REQUIRED'; end if; v_source:=v_source||jsonb_build_object('updatedDocuments',coalesce(p_updated_documents,''),'completedBy',v_actor,'completedAt',now()); v_status:='COMPLETED';
  else raise exception 'UNKNOWN_TOOLING_ACTION'; end if;
  update public.tooling_modification set status=v_status,source_data=v_source,updated_at=now() where modification_id=p_modification_id;
  v_audit:='AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail) values(v_audit,'Tooling_Modification',p_modification_id,p_action,v_actor,jsonb_build_object('before',v_row.status,'after',v_status));
  return jsonb_build_object('modificationId',p_modification_id,'status',v_status);
end $$;
