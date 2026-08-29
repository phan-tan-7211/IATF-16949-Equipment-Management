create or replace function public.rpc_cutover_diagnostics()
returns jsonb
language sql
security definer
set search_path = public, storage
as $$
  with equipment_counts as (
    select
      count(*)::int as equipment_total,
      count(*) filter (where equipment_type = 'PRODUCTION')::int as production_total,
      count(*) filter (where equipment_type = 'MEASUREMENT')::int as measurement_total
    from public.equipment_master
  ),
  issue_counts as (
    select jsonb_build_object(
      'duplicate_equipment_id', (
        select count(*)::int from (
          select equipment_id from public.equipment_master group by equipment_id having count(*) > 1
        ) x
      ),
      'duplicate_nonblank_serial_groups', (
        select count(*)::int from (
          select serial_number from public.equipment_master
          where nullif(trim(serial_number), '') is not null
          group by serial_number having count(*) > 1
        ) x
      ),
      'calibration_orphan_equipment', (
        select count(*)::int from public.calibration_master c
        left join public.equipment_master e on e.equipment_id = c.equipment_id
        where e.equipment_id is null
      ),
      'calibration_wrong_type', (
        select count(*)::int from public.calibration_master c
        join public.equipment_master e on e.equipment_id = c.equipment_id
        where e.equipment_type <> 'MEASUREMENT'
      ),
      'inspection_orphan_equipment', (
        select count(*)::int from public.daily_inspection d
        left join public.equipment_master e on e.equipment_id = d.equipment_id
        where e.equipment_id is null
      ),
      'wo_orphan_equipment', (
        select count(*)::int from public.maintenance_work_order w
        left join public.equipment_master e on e.equipment_id = w.equipment_id
        where e.equipment_id is null
      ),
      'downtime_orphan_equipment', (
        select count(*)::int from public.downtime_event d
        left join public.equipment_master e on e.equipment_id = d.equipment_id
        where e.equipment_id is null
      ),
      'handover_orphan_equipment', (
        select count(*)::int from public.equipment_handover h
        left join public.equipment_master e on e.equipment_id = h.equipment_id
        where e.equipment_id is null
      ),
      'movement_orphan_equipment', (
        select count(*)::int from public.equipment_movement_log m
        left join public.equipment_master e on e.equipment_id = m.equipment_id
        where e.equipment_id is null
      )
    ) as value
  ),
  photo_counts as (
    select jsonb_build_object(
      'canonical_photo_objects', count(*) filter (
        where bucket_id = 'equipment-photos' and name ~ '^[^/]+/photo\\.webp$'
      )::int,
      'noncanonical_photo_objects', count(*) filter (
        where bucket_id = 'equipment-photos' and name !~ '^[^/]+/photo\\.webp$'
      )::int,
      'photo_ids_without_equipment', (
        select count(*)::int
        from (
          select distinct split_part(name, '/', 1) as equipment_id
          from storage.objects
          where bucket_id = 'equipment-photos'
        ) p
        left join public.equipment_master e on e.equipment_id = p.equipment_id
        where e.equipment_id is null
      )
    ) as value
    from storage.objects
    where bucket_id = 'equipment-photos'
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'equipment_total', ec.equipment_total,
      'production_total', ec.production_total,
      'measurement_total', ec.measurement_total,
      'calibration_master_total', (select count(*)::int from public.calibration_master),
      'work_order_total', (select count(*)::int from public.maintenance_work_order),
      'inspection_total', (select count(*)::int from public.daily_inspection),
      'downtime_total', (select count(*)::int from public.downtime_event),
      'tooling_total', (select count(*)::int from public.tooling_master),
      'audit_total', (select count(*)::int from public.audit_log)
    ),
    'issues', ic.value,
    'storage', pc.value,
    'pass', not exists (
      select 1 from jsonb_each_text(ic.value) item where item.value::int <> 0
    ) and (pc.value->>'noncanonical_photo_objects')::int = 0
      and (pc.value->>'photo_ids_without_equipment')::int = 0
  )
  from equipment_counts ec
  cross join issue_counts ic
  cross join photo_counts pc;
$$;

revoke all on function public.rpc_cutover_diagnostics() from public;
grant execute on function public.rpc_cutover_diagnostics() to authenticated;
