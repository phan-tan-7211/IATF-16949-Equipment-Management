-- TEST ONLY seed data for feat/supabase-r2-migration
insert into public.equipment_master (
  equipment_id, equipment_type, control_number, qr_code, equipment_name, model, manufacturer, serial_number, department, status, active
) values
  ('CEV-TEST-PR-001','PRODUCTION','TEST-PR-001','CEV-TEST-PR-001','Test Production Machine 01','TEST-MODEL-A','CEV TEST','TEST-SN-001','PRODUCTION','RUNNING',true),
  ('CEV-TEST-PR-002','PRODUCTION','TEST-PR-002','CEV-TEST-PR-002','Test Production Machine 02','TEST-MODEL-B','CEV TEST','TEST-SN-002','PRODUCTION','STOPPED',true),
  ('CEV-TEST-ME-001','MEASUREMENT','TEST-ME-001','CEV-TEST-ME-001','Test LCR Meter','TEST-LCR','CEV TEST','TEST-ME-SN-001','QUALITY','RUNNING',true),
  ('CEV-TEST-ME-002','MEASUREMENT','TEST-ME-002','CEV-TEST-ME-002','Test Caliper','TEST-CALIPER','CEV TEST','TEST-ME-SN-002','QUALITY','RUNNING',true)
on conflict (equipment_id) do nothing;

insert into public.calibration_master (
  calibration_id, equipment_id, last_calibration_date, next_due_date, status
) values
  ('CAL-TEST-001','CEV-TEST-ME-001','2026-07-01','2027-07-01','LINKED'),
  ('CAL-TEST-002','CEV-TEST-ME-002','2026-07-02','2027-07-02','LINKED')
on conflict (calibration_id) do nothing;
