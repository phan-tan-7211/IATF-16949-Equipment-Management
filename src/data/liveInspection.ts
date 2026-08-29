import { supabase } from './supabaseClient'

export type DailyInspectionMark = 'V' | 'URGENT_REPAIR' | 'MAINTENANCE_REQUIRED' | 'STOP_REPAIR'
export type DailyInspectionShift = 'MORNING' | 'AFTERNOON' | 'NIGHT'
export type WorkOrderPriority = '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type InspectionEquipmentOption = {
  equipmentId: string
  equipmentName: string
  currentArea: string
  currentLine: string
}

export type LiveInspection = {
  inspectionId: string
  equipmentId: string
  inspectionDate: string
  shift: string
  area: string
  inspectorId: string
  overallMark: string
  note: string
  damagedParts: string
  createdAt: string
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function normalizeInspectionEquipment(rows: Array<Record<string, unknown>>): InspectionEquipmentOption[] {
  return rows
    .filter((row) => text(row.equipment_id) && text(row.equipment_type) === 'PRODUCTION' && text(row.status) !== 'DISPOSED')
    .map((row) => ({
      equipmentId: text(row.equipment_id),
      equipmentName: text(row.equipment_name),
      currentArea: text(row.department),
      currentLine: text((row.source_data as Record<string, unknown> | null)?.currentLine),
    }))
    .sort((a, b) => a.equipmentId.localeCompare(b.equipmentId))
}

export function normalizeInspections(rows: Array<Record<string, unknown>>): LiveInspection[] {
  return rows
    .filter((row) => text(row.inspection_id))
    .map((row) => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      return {
        inspectionId: text(row.inspection_id),
        equipmentId: text(row.equipment_id),
        inspectionDate: text(row.inspection_date),
        shift: text(row.shift),
        area: text(row.area),
        inspectorId: text(row.actor_email),
        overallMark: text(row.overall_mark),
        note: text(row.note),
        damagedParts: text(source.damagedParts),
        createdAt: text(row.created_at),
      }
    })
    .sort((a, b) => (b.createdAt || b.inspectionDate).localeCompare(a.createdAt || a.inspectionDate))
}

export async function loadLiveInspection() {
  const [equipmentResult, inspectionResult] = await Promise.all([
    supabase.from('equipment_master').select('equipment_id,equipment_type,equipment_name,department,status,source_data').eq('active', true),
    supabase.from('daily_inspection').select('*').order('created_at', { ascending: false }).limit(100),
  ])
  if (equipmentResult.error) throw equipmentResult.error
  if (inspectionResult.error) throw inspectionResult.error
  return {
    equipment: normalizeInspectionEquipment((equipmentResult.data || []) as Array<Record<string, unknown>>),
    inspections: normalizeInspections((inspectionResult.data || []) as Array<Record<string, unknown>>),
  }
}

export async function submitLiveInspection(request: {
  operationId: string
  equipmentId: string
  shift: DailyInspectionShift
  area: string
  overallMark: DailyInspectionMark
  note: string
  damagedParts: string
  priority: WorkOrderPriority
}) {
  const { data, error } = await supabase.rpc('rpc_submit_daily_inspection', {
    p_operation_id: request.operationId,
    p_equipment_id: request.equipmentId,
    p_shift: request.shift,
    p_area: request.area,
    p_overall_mark: request.overallMark,
    p_note: request.note,
    p_damaged_parts: request.damagedParts,
    p_priority: request.priority,
  })
  if (error) throw error
  const result = (data || {}) as Record<string, unknown>
  return {
    result: {
      inspectionId: text(result.inspectionId),
      workOrderId: text(result.workOrderId),
      downtimeId: text(result.downtimeId),
    },
  }
}
