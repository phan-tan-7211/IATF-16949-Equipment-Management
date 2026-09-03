-- Spare Parts Risk V1: lightweight replacement-part intelligence for equipment management.
-- Goal: identify shared parts, explain spare necessity, keep minimum stock and replacement history.

create table public.spare_part_master (
  part_id text primary key,
  part_name text not null,
  part_number text,
  maker text,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  min_qty integer not null default 0 check (min_qty >= 0),
  location text,
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  stops_production boolean not null default false,
  quality_safety_impact boolean not null default false,
  lead_time_exceeds_recovery boolean not null default false,
  rationale_note text,
  active boolean not null default true,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment_spare_part (
  part_id text not null references public.spare_part_master(part_id) on delete cascade,
  equipment_id text not null references public.equipment_master(equipment_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (part_id, equipment_id)
);

create table public.spare_part_usage (
  usage_id text primary key,
  part_id text not null references public.spare_part_master(part_id),
  equipment_id text not null references public.equipment_master(equipment_id),
  quantity integer not null check (quantity > 0),
  used_at timestamptz not null default now(),
  work_order_id text references public.maintenance_work_order(work_order_id),
  reason text,
  performed_by text,
  actor_email text,
  created_at timestamptz not null default now()
);

create index spare_part_usage_part_idx on public.spare_part_usage(part_id, used_at desc);
create index spare_part_usage_equipment_idx on public.spare_part_usage(equipment_id, used_at desc);
create index equipment_spare_part_equipment_idx on public.equipment_spare_part(equipment_id, part_id);

alter table public.spare_part_master enable row level security;
alter table public.equipment_spare_part enable row level security;
alter table public.spare_part_usage enable row level security;

create policy spare_part_master_read on public.spare_part_master for select to authenticated using (public.is_authenticated());
create policy equipment_spare_part_read on public.equipment_spare_part for select to authenticated using (public.is_authenticated());
create policy spare_part_usage_read on public.spare_part_usage for select to authenticated using (public.is_authenticated());

-- Classification is deliberately derived, not manually selected.
-- shared_critical = part is mapped to 2+ A/B equipment records.
create or replace view public.spare_part_overview as
with mapped as (
  select
    esp.part_id,
    count(*)::integer as equipment_count,
    count(*) filter (where upper(coalesce(em.source_data->>'criticality','')) in ('A','B'))::integer as critical_equipment_count,
    coalesce(jsonb_agg(jsonb_build_object(
      'equipmentId', em.equipment_id,
      'equipmentName', coalesce(em.equipment_name, em.equipment_id),
      'criticality', coalesce(em.source_data->>'criticality','')
    ) order by em.equipment_id) filter (where em.equipment_id is not null), '[]'::jsonb) as equipment
  from public.equipment_spare_part esp
  join public.equipment_master em on em.equipment_id = esp.equipment_id
  group by esp.part_id
)
select
  sp.*,
  coalesce(m.equipment_count,0) as equipment_count,
  coalesce(m.critical_equipment_count,0) as critical_equipment_count,
  (coalesce(m.critical_equipment_count,0) >= 2) as shared_critical,
  (
    sp.stops_production::int +
    sp.quality_safety_impact::int +
    sp.lead_time_exceeds_recovery::int +
    (coalesce(m.critical_equipment_count,0) >= 2)::int
  ) as risk_score,
  case
    when sp.quality_safety_impact
      or (sp.stops_production and sp.lead_time_exceeds_recovery)
      or (
        sp.stops_production::int + sp.quality_safety_impact::int + sp.lead_time_exceeds_recovery::int + (coalesce(m.critical_equipment_count,0) >= 2)::int
      ) >= 3 then 'REQUIRED'
    when (
        sp.stops_production::int + sp.quality_safety_impact::int + sp.lead_time_exceeds_recovery::int + (coalesce(m.critical_equipment_count,0) >= 2)::int
      ) = 2 then 'RECOMMENDED'
    else 'NORMAL'
  end as spare_classification,
  coalesce(m.equipment,'[]'::jsonb) as equipment
from public.spare_part_master sp
left join mapped m on m.part_id = sp.part_id;

grant select on public.spare_part_overview to authenticated;

create or replace function public.rpc_save_spare_part(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_part_id text;
  v_part_name text;
  v_equipment_id text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'SPARE_PART_ROLE_DENIED'; end if;

  v_part_id:=upper(trim(coalesce(p_input->>'partId','')));
  v_part_name:=trim(coalesce(p_input->>'partName',''));
  if v_part_id='' then raise exception 'PART_ID_REQUIRED'; end if;
  if v_part_name='' then raise exception 'PART_NAME_REQUIRED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');

  insert into public.spare_part_master(
    part_id,part_name,part_number,maker,stock_qty,min_qty,location,lead_time_days,
    stops_production,quality_safety_impact,lead_time_exceeds_recovery,rationale_note,active,created_by,updated_by
  ) values (
    v_part_id,v_part_name,nullif(trim(coalesce(p_input->>'partNumber','')),''),nullif(trim(coalesce(p_input->>'maker','')),''),
    greatest(coalesce((p_input->>'stockQty')::integer,0),0),greatest(coalesce((p_input->>'minQty')::integer,0),0),
    nullif(trim(coalesce(p_input->>'location','')),''),nullif(p_input->>'leadTimeDays','')::integer,
    coalesce((p_input->>'stopsProduction')::boolean,false),coalesce((p_input->>'qualitySafetyImpact')::boolean,false),
    coalesce((p_input->>'leadTimeExceedsRecovery')::boolean,false),nullif(trim(coalesce(p_input->>'rationaleNote','')),''),true,v_actor,v_actor
  )
  on conflict (part_id) do update set
    part_name=excluded.part_name,part_number=excluded.part_number,maker=excluded.maker,
    stock_qty=excluded.stock_qty,min_qty=excluded.min_qty,location=excluded.location,lead_time_days=excluded.lead_time_days,
    stops_production=excluded.stops_production,quality_safety_impact=excluded.quality_safety_impact,
    lead_time_exceeds_recovery=excluded.lead_time_exceeds_recovery,rationale_note=excluded.rationale_note,
    active=true,updated_by=v_actor,updated_at=now();

  delete from public.equipment_spare_part where part_id=v_part_id;
  for v_equipment_id in select jsonb_array_elements_text(coalesce(p_input->'equipmentIds','[]'::jsonb)) loop
    if exists(select 1 from public.equipment_master where equipment_id=v_equipment_id) then
      insert into public.equipment_spare_part(part_id,equipment_id) values(v_part_id,v_equipment_id) on conflict do nothing;
    end if;
  end loop;

  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    'Spare_Part',v_part_id,'SAVE_SPARE_PART',v_actor,
    jsonb_build_object('equipmentIds',coalesce(p_input->'equipmentIds','[]'::jsonb),'stockQty',coalesce((p_input->>'stockQty')::integer,0),'minQty',coalesce((p_input->>'minQty')::integer,0)));

  return (select to_jsonb(v) from public.spare_part_overview v where v.part_id=v_part_id);
end $$;

grant execute on function public.rpc_save_spare_part(jsonb) to authenticated;

create or replace function public.rpc_record_spare_usage(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_part_id text;
  v_equipment_id text;
  v_quantity integer;
  v_usage_id text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'SPARE_USAGE_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_part_id:=upper(trim(coalesce(p_input->>'partId','')));
  v_equipment_id:=upper(trim(coalesce(p_input->>'equipmentId','')));
  v_quantity:=greatest(coalesce((p_input->>'quantity')::integer,1),1);
  if not exists(select 1 from public.spare_part_master where part_id=v_part_id) then raise exception 'SPARE_PART_NOT_FOUND'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id) then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  v_usage_id:='SPU-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);

  insert into public.spare_part_usage(usage_id,part_id,equipment_id,quantity,used_at,work_order_id,reason,performed_by,actor_email)
  values(v_usage_id,v_part_id,v_equipment_id,v_quantity,coalesce((p_input->>'usedAt')::timestamptz,now()),
    nullif(trim(coalesce(p_input->>'workOrderId','')),''),nullif(trim(coalesce(p_input->>'reason','')),''),
    nullif(trim(coalesce(p_input->>'performedBy','')),''),v_actor);

  update public.spare_part_master set stock_qty=greatest(stock_qty-v_quantity,0),updated_by=v_actor,updated_at=now() where part_id=v_part_id;
  insert into public.equipment_spare_part(part_id,equipment_id) values(v_part_id,v_equipment_id) on conflict do nothing;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),v_equipment_id,
    'Spare_Part_Usage',v_usage_id,'RECORD_SPARE_USAGE',v_actor,jsonb_build_object('partId',v_part_id,'quantity',v_quantity));
  return jsonb_build_object('usageId',v_usage_id,'partId',v_part_id,'equipmentId',v_equipment_id,'quantity',v_quantity);
end $$;

grant execute on function public.rpc_record_spare_usage(jsonb) to authenticated;
