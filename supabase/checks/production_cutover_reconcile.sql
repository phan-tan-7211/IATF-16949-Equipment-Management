-- Production cutover reconciliation check.
-- Read-only. Run before merge, immediately after production deploy, and after any rollback.

with counts as (
  select
    (select count(*) from public.equipment_master) as equipment_total,
    (select count(*) from public.equipment_master where equipment_type = 'PRODUCTION') as production_total,
    (select count(*) from public.equipment_master where equipment_type = 'MEASUREMENT') as measurement_total,
    (select count(*) from public.calibration_master) as calibration_master_total,
    (select count(*) from public.maintenance_work_order) as work_order_total,
    (select count(*) from public.daily_inspection) as inspection_total,
    (select count(*) from public.downtime_event) as downtime_total,
    (select count(*) from public.tooling_master) as tooling_total,
    (select count(*) from public.audit_log) as audit_total
), integrity as (
  select
    (select count(*) from public.calibration_master c left join public.equipment_master e on e.equipment_id = c.equipment_id where e.equipment_id is null) as calibration_orphan_equipment,
    (select count(*) from public.calibration_master c join public.equipment_master e on e.equipment_id = c.equipment_id where e.equipment_type <> 'MEASUREMENT') as calibration_wrong_type,
    (select count(*) from public.maintenance_work_order w left join public.equipment_master e on e.equipment_id = w.equipment_id where e.equipment_id is null) as wo_orphan_equipment,
    (select count(*) from public.daily_inspection d left join public.equipment_master e on e.equipment_id = d.equipment_id where e.equipment_id is null) as inspection_orphan_equipment,
    (select count(*) from public.downtime_event d left join public.equipment_master e on e.equipment_id = d.equipment_id where e.equipment_id is null) as downtime_orphan_equipment,
    (select count(*) from public.equipment_handover h left join public.equipment_master e on e.equipment_id = h.equipment_id where e.equipment_id is null) as handover_orphan_equipment,
    (select count(*) from public.equipment_movement_log m left join public.equipment_master e on e.equipment_id = m.equipment_id where e.equipment_id is null) as movement_orphan_equipment,
    (select count(*) from (select equipment_id from public.equipment_master group by equipment_id having count(*) > 1) x) as duplicate_equipment_id_groups,
    (select count(*) from (select serial_number from public.equipment_master where nullif(trim(serial_number), '') is not null group by serial_number having count(*) > 1) x) as duplicate_nonblank_serial_groups
), photos as (
  select
    (select count(*) from storage.objects where bucket_id = 'equipment-photos') as equipment_photo_objects,
    (select count(*) from storage.objects where bucket_id = 'equipment-photos' and name like '%/photo.webp') as canonical_photo_objects,
    (select count(*) from storage.objects where bucket_id = 'equipment-photos' and name not like '%/photo.webp') as noncanonical_photo_objects,
    (select count(*) from storage.objects o left join public.equipment_master e on e.equipment_id = split_part(o.name, '/', 1) where o.bucket_id = 'equipment-photos' and e.equipment_id is null) as photo_ids_without_equipment,
    (select count(distinct split_part(name, '/', 1)) from storage.objects where bucket_id = 'equipment-photos' and name like '%/photo.webp') as equipment_with_photo,
    (select count(*) from public.equipment_master e where not exists (
      select 1 from storage.objects o where o.bucket_id = 'equipment-photos' and o.name = e.equipment_id || '/photo.webp'
    )) as equipment_without_photo
)
select
  row_to_json(counts) as counts,
  row_to_json(integrity) as integrity,
  row_to_json(photos) as photos
from counts, integrity, photos;
