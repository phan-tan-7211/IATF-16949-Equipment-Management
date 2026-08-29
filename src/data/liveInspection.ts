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
  const session = await supabase.auth.getSession()
  const actorEmail = session.data.session?.user.email || ''
  const now = new Date()
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14)
  const suffix = request.operationId.slice(-6).replace(/[^a-zA-Z0-9]/g, '') || Math.random().toString(36).slice(2, 8)
  const inspectionId = `INSP-${stamp}-${suffix}`

  const { error: inspectionError } = await supabase.from('daily_inspection').insert({
    inspection_id: inspectionId,
    equipment_id: request.equipmentId,
    inspection_date: now.toISOString().slice(0, 10),
    shift: request.shift,
    area: request.area,
    overall_mark: request.overallMark,
    note: request.note.trim() || null,
    actor_email: actorEmail || null,
    source_data: { damagedParts: request.damagedParts.trim(), operationId: request.operationId },
  })
  if (inspectionError) throw inspectionError

  let workOrderId = ''
  if (request.overallMark === 'STOP_REPAIR') {
    workOrderId = `WO-${stamp}-${suffix}`
    const downtimeId = `DT-${stamp}-${suffix}`
    const { error: woError } = await supabase.from('maintenance_work_order').insert({
      work_order_id: workOrderId,
      equipment_id: request.equipmentId,
      status: 'OPEN',
      priority: request.priority || 'HIGH',
      reason: request.note.trim(),
      source_type: 'DAILY_INSPECTION',
      source_id: inspectionId,
      created_by: actorEmail || null,
      source_data: { damagedParts: request.damagedParts.trim(), operationId: request.operationId },
    })
    if (woError) throw woError
    const { error: downtimeError } = await supabase.from('downtime_event').insert({
      downtime_id: downtimeId,
      equipment_id: request.equipmentId,
      work_order_id: workOrderId,
      started_at: now.toISOString(),
      source_data: { inspectionId },
    })
    if (downtimeError) throw downtimeError
  }

  return { result: { inspectionId, workOrderId } }
}
