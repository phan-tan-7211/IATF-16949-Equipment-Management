-- CEV Equipment Management - Supabase TEST foundation
-- Contract: G1-frozen-2026-08-28
-- TEST ONLY. Do not point production frontend at this database yet.

create extension if not exists pgcrypto;

create type public.app_role as enum ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN');
create type public.equipment_type as enum ('PRODUCTION','MEASUREMENT');

create table public.app_user_role (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_user_role where user_id = auth.uid()
$$;

create or replace function public.is_authenticated()
returns boolean language sql stable as $$ select auth.uid() is not null $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() = 'ADMIN'::public.app_role, false) $$;

-- Root equipment record. equipment_id is immutable canonical identity.
create table public.equipment_master (
  equipment_id text primary key,
  equipment_type public.equipment_type not null,
  control_number text,
  qr_code text not null unique,
  equipment_name text,
  model text,
  manufacturer text,
  serial_number text,
  department text,
  status text,
  active boolean not null default true,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_qr_matches_id check (qr_code = equipment_id)
);

create table public.daily_inspection (
  inspection_id text primary key,
  equipment_id text not null references public.equipment_master(equipment_id),
  inspection_date date,
  shift text,
  area text,
  overall_mark text,
  note text,
  actor_email text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.daily_inspection_item (
  item_id text primary key,
  inspection_id text not null references public.daily_inspection(inspection_id) on delete cascade,
  equipment_id text not null references public.equipment_master(equipment_id),
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.maintenance_plan (
  plan_id text primary key,
  equipment_id text not null references public.equipment_master(equipment_id),
  active boolean not null default true,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.maintenance_plan_item (
  item_id text primary key,
  plan_id text not null references public.maintenance_plan(plan_id) on delete cascade,
  equipment_id text not null references public.equipment_master(equipment_id),
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.maintenance_work_order (
  work_order_id text primary key,
  equipment_id text not null references public.equipment_master(equipment_id),
  status text not null default 'OPEN',
  priority text,
  reason text,
  source_type text,
  source_id text,
  created_by text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.maintenance_execution (
  execution_id text primary key,
  work_order_id text not null references public.maintenance_work_order(work_order_id),
  equipment_id text not null references public.equipment_master(equipment_id),
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.maintenance_result_item (
  result_item_id text primary key,
  execution_id text references public.maintenance_execution(execution_id),
  work_order_id text not null references public.maintenance_work_order(work_order_id),
  equipment_id text not null references public.equipment_master(equipment_id),
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.maintenance_log (
  log_id text primary key,
  work_order_id text references public.maintenance_work_order(work_order_id),
  equipment_id text not null references public.equipment_master(equipment_id),
  action text,
  actor_email text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.equipment_handover (
  handover_id text primary key,
  work_order_id text references public.maintenance_work_order(work_order_id),
  equipment_id text not null references public.equipment_master(equipment_id),
  accepted boolean,
  equipment_condition text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.downtime_event (
  downtime_id text primary key,
  equipment_id text not null references public.equipment_master(equipment_id),
  work_order_id text references public.maintenance_work_order(work_order_id),
  started_at timestamptz,
  ended_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tooling_master (
  tooling_id text primary key,
  tooling_type text,
  status text,
  ownership text,
  active boolean not null default true,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.tooling_maintenance_plan (
  tooling_plan_id text primary key,
  tooling_id text not null references public.tooling_master(tooling_id),
  frequency_type text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.tooling_modification (
  modification_id text primary key,
  tooling_id text not null references public.tooling_master(tooling_id),
  modification_type text,
  status text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calibration_master (
  calibration_id text primary key,
  equipment_id text not null unique references public.equipment_master(equipment_id),
  last_calibration_date date,
  next_due_date date,
  status text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.calibration_log (
  calibration_log_id text primary key,
  equipment_id text not null references public.equipment_master(equipment_id),
  calibration_date date not null,
  next_due_date date not null,
  result text not null,
  actor_email text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint calibration_due_after_date check (next_due_date >= calibration_date)
);
create table public.calibration_vendor_quote (
  quote_id text primary key,
  equipment_id text references public.equipment_master(equipment_id),
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.calibration_quote_summary (
  summary_id text primary key,
  equipment_id text references public.equipment_master(equipment_id),
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.equipment_movement_log (
  movement_id text primary key,
  equipment_id text not null references public.equipment_master(equipment_id),
  from_location text,
  to_location text,
  actor_email text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.audit_log (
  audit_id text primary key,
  equipment_id text references public.equipment_master(equipment_id),
  entity_type text,
  entity_id text,
  action text not null,
  actor_email text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index daily_inspection_equipment_idx on public.daily_inspection(equipment_id, inspection_date desc);
create index maintenance_wo_equipment_idx on public.maintenance_work_order(equipment_id, status);
create index downtime_equipment_idx on public.downtime_event(equipment_id, started_at desc);
create index calibration_log_equipment_idx on public.calibration_log(equipment_id, calibration_date desc);
create index audit_entity_idx on public.audit_log(entity_type, entity_id, created_at desc);

-- RLS: authenticated users can read business data. Writes are initially restricted
-- to authorized roles; workflow-specific restrictions will be moved into RPC functions.
do $$
declare t text;
begin
  foreach t in array array[
    'equipment_master','daily_inspection','daily_inspection_item','maintenance_plan','maintenance_plan_item',
    'maintenance_work_order','maintenance_execution','maintenance_result_item','maintenance_log','equipment_handover',
    'downtime_event','tooling_master','tooling_maintenance_plan','tooling_modification','calibration_master','calibration_log',
    'calibration_vendor_quote','calibration_quote_summary','equipment_movement_log','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_authenticated())', t || '_read', t);
  end loop;
end $$;

alter table public.app_user_role enable row level security;
create policy app_user_role_self_read on public.app_user_role
for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ADMIN may manage root/config records during TEST.
create policy equipment_admin_all on public.equipment_master for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy tooling_admin_all on public.tooling_master for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy calibration_master_admin_all on public.calibration_master for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Business write policies for TEST. Phase 2 will replace sensitive workflow mutations with RPC.
create policy inspection_write on public.daily_inspection for insert to authenticated
with check (public.current_app_role() in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN'));
create policy inspection_item_write on public.daily_inspection_item for insert to authenticated
with check (public.current_app_role() in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN'));
create policy maintenance_wo_write on public.maintenance_work_order for all to authenticated
using (public.current_app_role() in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN'))
with check (public.current_app_role() in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN'));
create policy calibration_log_write on public.calibration_log for insert to authenticated
with check (public.current_app_role() in ('QUALITY','MANAGER','ADMIN'));

-- Audit is ADMIN-only, preserving the current production security rule.
drop policy audit_log_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());
create policy audit_admin_insert on public.audit_log for insert to authenticated with check (public.is_admin());

-- Storage buckets: private by default.
insert into storage.buckets (id, name, public)
values
 ('equipment-photos','equipment-photos',false),
 ('manuals-and-setup','manuals-and-setup',false),
 ('maintenance-before-after','maintenance-before-after',false),
 ('calibration-certificates','calibration-certificates',false),
 ('calibration-label-photos','calibration-label-photos',false),
 ('tooling-drawings','tooling-drawings',false),
 ('tooling-change-attachments','tooling-change-attachments',false),
 ('handover-records','handover-records',false),
 ('official-pdf-snapshots','official-pdf-snapshots',false)
on conflict (id) do nothing;

create policy evidence_authenticated_read on storage.objects
for select to authenticated
using (bucket_id in (
 'equipment-photos','manuals-and-setup','maintenance-before-after','calibration-certificates',
 'calibration-label-photos','tooling-drawings','tooling-change-attachments','handover-records','official-pdf-snapshots'
));

create policy evidence_authorized_upload on storage.objects
for insert to authenticated
with check (
  bucket_id in (
   'equipment-photos','manuals-and-setup','maintenance-before-after','calibration-certificates',
   'calibration-label-photos','tooling-drawings','tooling-change-attachments','handover-records','official-pdf-snapshots'
  )
  and public.current_app_role() in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN')
);

create policy evidence_admin_update on storage.objects
for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy evidence_admin_delete on storage.objects
for delete to authenticated using (public.is_admin());
