export const PERSISTENCE_TABLES = [
  'Equipment_Master',
  'Daily_Inspection',
  'Daily_Inspection_Item',
  'Maintenance_Plan',
  'Maintenance_Plan_Item',
  'Maintenance_Work_Order',
  'Maintenance_Execution',
  'Maintenance_Result_Item',
  'Maintenance_Log',
  'Equipment_Handover',
  'Downtime_Event',
  'Tooling_Master',
  'Tooling_Maintenance_Plan',
  'Tooling_Modification',
  'Calibration_Master',
  'Calibration_Log',
  'Calibration_Vendor_Quote',
  'Calibration_Quote_Summary',
  'Equipment_Movement_Log',
  'Audit_Log',
] as const

export const EVIDENCE_FOLDERS = [
  'equipment-photos',
  'manuals-and-setup',
  'maintenance-before-after',
  'calibration-certificates',
  'calibration-label-photos',
  'tooling-drawings',
  'tooling-change-attachments',
  'handover-records',
  'official-pdf-snapshots',
] as const

export const PERSISTENCE_CONTRACT_VERSION = 'G1-frozen-2026-08-28'
