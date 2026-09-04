create table if not exists public.equipment_inventory_session (
  session_id text primary key,
  name text not null,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_inventory_result (
  session_id text not null references public.equipment_inventory_session(session_id) on delete cascade,
  equipment_id text not null,
  status text not null check (status in ('FOUND_LABEL_OK','FOUND_NO_LABEL','MOVED','NOT_FOUND','DATA_INVALID')),
  actual_area text,
  actual_line text,
  note text,
  source text not null default 'MANUAL' check (source in ('QR','MANUAL')),
  checked_at timestamptz not null default now(),
  checked_by text not null,
  primary key (session_id,equipment_id)
);

create index if not exists idx_equipment_inventory_session_status on public.equipment_inventory_session(status,started_at desc);
create index if not exists idx_equipment_inventory_result_status on public.equipment_inventory_result(session_id,status);

alter table public.equipment_inventory_session enable row level security;
alter table public.equipment_inventory_result enable row level security;

drop policy if exists equipment_inventory_session_select_authenticated on public.equipment_inventory_session;
create policy equipment_inventory_session_select_authenticated on public.equipment_inventory_session for select to authenticated using (auth.uid() is not null);

drop policy if exists equipment_inventory_result_select_authenticated on public.equipment_inventory_result;
create policy equipment_inventory_result_select_authenticated on public.equipment_inventory_result for select to authenticated using (auth.uid() is not null);

create or replace function public.rpc_create_equipment_inventory_session(p_session_id text,p_name text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor text;
  v_role text;
  v_session public.equipment_inventory_session%rowtype;
begin
  v_role:=coalesce(public.current_app_role()::text,'');
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'INVENTORY_ROLE_REQUIRED'; end if;
  if nullif(trim(p_session_id),'') is null then raise exception 'SESSION_ID_REQUIRED'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'SESSION_NAME_REQUIRED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  insert into public.equipment_inventory_session(session_id,name,status,created_by)
  values(upper(trim(p_session_id)),trim(p_name),'OPEN',v_actor)
  on conflict (session_id) do nothing;

  select * into v_session from public.equipment_inventory_session where session_id=upper(trim(p_session_id));
  if not found then raise exception 'SESSION_CREATE_FAILED'; end if;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),null,'Equipment_Inventory',v_session.session_id,'INVENTORY_SESSION_CREATE',v_actor,jsonb_build_object('sessionId',v_session.session_id,'name',v_session.name))
  on conflict do nothing;

  return jsonb_build_object('sessionId',v_session.session_id,'name',v_session.name,'status',v_session.status,'startedAt',v_session.started_at,'closedAt',v_session.closed_at,'createdBy',v_session.created_by,'updatedAt',v_session.updated_at);
end $$;

create or replace function public.rpc_record_equipment_inventory(
  p_session_id text,
  p_equipment_id text,
  p_status text,
  p_actual_area text default '',
  p_actual_line text default '',
  p_note text default '',
  p_source text default 'MANUAL'
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

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  insert into public.equipment_inventory_result(session_id,equipment_id,status,actual_area,actual_line,note,source,checked_at,checked_by)
  values(
    upper(trim(p_session_id)),v_equipment_id,v_status,
    case when v_status='MOVED' then nullif(trim(coalesce(p_actual_area,'')),'') else null end,
    case when v_status='MOVED' then nullif(trim(coalesce(p_actual_line,'')),'') else null end,
    nullif(trim(coalesce(p_note,'')),''),v_source,now(),v_actor
  )
  on conflict (session_id,equipment_id) do update set
    status=excluded.status,
    actual_area=excluded.actual_area,
    actual_line=excluded.actual_line,
    note=excluded.note,
    source=excluded.source,
    checked_at=excluded.checked_at,
    checked_by=excluded.checked_by;

  select * into v_result from public.equipment_inventory_result where session_id=upper(trim(p_session_id)) and equipment_id=v_equipment_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_equipment_id,'Equipment_Inventory',upper(trim(p_session_id)),'INVENTORY_CHECK',v_actor,jsonb_build_object('sessionId',upper(trim(p_session_id)),'equipmentId',v_equipment_id,'status',v_status,'source',v_source,'actualArea',v_result.actual_area,'actualLine',v_result.actual_line,'note',v_result.note));

  return jsonb_build_object('sessionId',v_result.session_id,'equipmentId',v_result.equipment_id,'status',v_result.status,'actualArea',coalesce(v_result.actual_area,''),'actualLine',coalesce(v_result.actual_line,''),'note',coalesce(v_result.note,''),'source',v_result.source,'checkedAt',v_result.checked_at,'checkedBy',v_result.checked_by);
end $$;

create or replace function public.rpc_close_equipment_inventory_session(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor text;
  v_role text;
  v_session public.equipment_inventory_session%rowtype;
begin
  v_role:=coalesce(public.current_app_role()::text,'');
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'INVENTORY_ROLE_REQUIRED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  update public.equipment_inventory_session set status='CLOSED',closed_at=coalesce(closed_at,now()),updated_at=now()
  where session_id=upper(trim(p_session_id)) returning * into v_session;
  if not found then raise exception 'INVENTORY_SESSION_NOT_FOUND'; end if;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),null,'Equipment_Inventory',v_session.session_id,'INVENTORY_SESSION_CLOSE',v_actor,jsonb_build_object('sessionId',v_session.session_id,'name',v_session.name));

  return jsonb_build_object('sessionId',v_session.session_id,'name',v_session.name,'status',v_session.status,'startedAt',v_session.started_at,'closedAt',v_session.closed_at,'createdBy',v_session.created_by,'updatedAt',v_session.updated_at);
end $$;

revoke all on function public.rpc_create_equipment_inventory_session(text,text) from public,anon;
revoke all on function public.rpc_record_equipment_inventory(text,text,text,text,text,text,text) from public,anon;
revoke all on function public.rpc_close_equipment_inventory_session(text) from public,anon;
grant execute on function public.rpc_create_equipment_inventory_session(text,text) to authenticated;
grant execute on function public.rpc_record_equipment_inventory(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.rpc_close_equipment_inventory_session(text) to authenticated;
