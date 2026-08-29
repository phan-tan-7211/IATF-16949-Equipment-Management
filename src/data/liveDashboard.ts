import { supabase } from './supabaseClient'
import { getCalibrationDueStatus } from '../domain/calibration'

export type LiveDashboardSummary = {
  equipmentTotal: number; productionCount: number; measurementCount: number; runningCount: number; downCount: number; calibrationTotal: number; calibrationOverdue: number; workOrderOpen: number; criticalOpen: number; pmOverdue: number; downtimeOpen: number; downtimeMinutes: number
}
function text(value: unknown) { return value == null ? '' : String(value).trim() }

export async function loadLiveDashboard(asOfDate = new Date().toISOString().slice(0, 10)): Promise<LiveDashboardSummary> {
  const [equipmentResult, calibrationResult, planResult, woResult, downtimeResult] = await Promise.all([
    supabase.from('equipment_master').select('equipment_id,equipment_type,status,active').eq('active', true),
    supabase.from('calibration_master').select('calibration_id,next_due_date'),
    supabase.from('maintenance_plan').select('plan_id,source_data,active'),
    supabase.from('maintenance_work_order').select('work_order_id,status,priority'),
    supabase.from('downtime_event').select('downtime_id,started_at,ended_at'),
  ])
  for (const result of [equipmentResult, calibrationResult, planResult, woResult, downtimeResult]) if (result.error) throw result.error

  const equipment = (equipmentResult.data || []) as Array<Record<string, unknown>>
  const calibration = (calibrationResult.data || []) as Array<Record<string, unknown>>
  const plans = (planResult.data || []) as Array<Record<string, unknown>>
  const workOrders = (woResult.data || []) as Array<Record<string, unknown>>
  const downtime = (downtimeResult.data || []) as Array<Record<string, unknown>>
  const openStatuses = new Set(['OPEN', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'])
  let downtimeMinutes = 0
  for (const row of downtime) {
    const start = row.started_at ? new Date(String(row.started_at)).getTime() : 0
    const end = row.ended_at ? new Date(String(row.ended_at)).getTime() : Date.now()
    if (start && end >= start) downtimeMinutes += Math.round((end - start) / 60000)
  }
  return {
    equipmentTotal: equipment.length,
    productionCount: equipment.filter((row) => text(row.equipment_type) === 'PRODUCTION').length,
    measurementCount: equipment.filter((row) => text(row.equipment_type) === 'MEASUREMENT').length,
    runningCount: equipment.filter((row) => text(row.status) === 'RUNNING').length,
    downCount: equipment.filter((row) => text(row.status) === 'DOWN').length,
    calibrationTotal: calibration.length,
    calibrationOverdue: calibration.filter((row) => getCalibrationDueStatus(text(row.next_due_date), asOfDate) === 'OVERDUE').length,
    workOrderOpen: workOrders.filter((row) => openStatuses.has(text(row.status))).length,
    criticalOpen: workOrders.filter((row) => openStatuses.has(text(row.status)) && text(row.priority) === 'CRITICAL').length,
    pmOverdue: plans.filter((row) => text((row.source_data as Record<string, unknown> | null)?.status) === 'OVERDUE').length,
    downtimeOpen: downtime.filter((row) => !row.ended_at).length,
    downtimeMinutes,
  }
}
