import { supabase } from './supabaseClient'

export type DowntimeCauseCategory = 'MECHANICAL' | 'ELECTRICAL' | 'WAITING_MATERIAL' | 'UNPLANNED_MAINTENANCE' | 'SETUP_CHANGEOVER' | 'NO_OPERATOR' | 'MATERIAL_SHORTAGE' | 'PROCESS_ERROR' | 'OTHER'

export type DowntimeEvent = {
  downtimeId: string
  equipmentId: string
  equipmentName: string
  area: string
  workOrderId: string
  startedAt: string
  endedAt: string
  causeCategory: DowntimeCauseCategory | ''
  detail: string
  actionTaken: string
  affectedDepartment: string
  recordedBy: string
  handledBy: string
  reportedBy: string
}

export type DowntimeEquipmentMonthly = {
  equipmentId: string
  equipmentName: string
  area: string
  downtimeMinutes: number
  failureCount: number
  runMinutes: number
  downtimeRate: number
  mtbfMinutes: number
  mttrMinutes: number
  days: number[]
}

export type DowntimeMonthlyReport = {
  month: string
  trackedDays: number
  totalAvailableMinutesPerEquipment: number
  productionEquipmentCount: number
  downtimeMinutes: number
  failureCount: number
  runMinutes: number
  downtimeRate: number
  mtbfMinutes: number
  mttrMinutes: number
  byEquipment: DowntimeEquipmentMonthly[]
  byCause: Array<{ cause: string; count: number; minutes: number }>
  events: DowntimeEvent[]
}

export type DowntimeInput = {
  downtimeId?: string
  equipmentId: string
  workOrderId?: string
  startedAt: string
  endedAt: string
  causeCategory: DowntimeCauseCategory
  detail: string
  actionTaken: string
  affectedDepartment: string
  recordedBy: string
  handledBy: string
  reportedBy: string
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function clampMinutes(start: Date, end: Date, windowStart: Date, windowEnd: Date) {
  const left = Math.max(start.getTime(), windowStart.getTime())
  const right = Math.min(end.getTime(), windowEnd.getTime())
  return Math.max(0, Math.round((right - left) / 60000))
}

export async function loadDowntimeMonthlyReport(month: string): Promise<DowntimeMonthlyReport> {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const windowStart = new Date(year, monthIndex, 1)
  const windowEnd = new Date(year, monthIndex + 1, 1)
  const trackedDays = Math.round((windowEnd.getTime() - windowStart.getTime()) / 86400000)
  const availablePerEquipment = trackedDays * 24 * 60

  const [equipmentResult, downtimeResult] = await Promise.all([
    supabase.from('equipment_master').select('equipment_id,equipment_name,current_area,equipment_type,active').eq('equipment_type', 'PRODUCTION').eq('active', true),
    supabase.from('downtime_event').select('*').lt('started_at', windowEnd.toISOString()).or(`ended_at.is.null,ended_at.gte.${windowStart.toISOString()}`),
  ])
  if (equipmentResult.error) throw equipmentResult.error
  if (downtimeResult.error) throw downtimeResult.error

  const equipmentRows = (equipmentResult.data || []) as Array<Record<string, unknown>>
  const equipmentMap = new Map(equipmentRows.map((row) => [text(row.equipment_id), { name: text(row.equipment_name), area: text(row.current_area) }]))
  const events: DowntimeEvent[] = []
  const now = new Date()

  for (const row of (downtimeResult.data || []) as Array<Record<string, unknown>>) {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    const equipmentId = text(row.equipment_id)
    const meta = equipmentMap.get(equipmentId)
    if (!meta) continue
    events.push({
      downtimeId: text(row.downtime_id), equipmentId, equipmentName: meta.name, area: meta.area, workOrderId: text(row.work_order_id),
      startedAt: text(row.started_at), endedAt: text(row.ended_at), causeCategory: text(source.causeCategory) as DowntimeEvent['causeCategory'], detail: text(source.detail), actionTaken: text(source.actionTaken), affectedDepartment: text(source.affectedDepartment), recordedBy: text(source.recordedBy), handledBy: text(source.handledBy), reportedBy: text(source.reportedBy),
    })
  }

  const byEquipment = equipmentRows.map((row): DowntimeEquipmentMonthly => {
    const equipmentId = text(row.equipment_id)
    const related = events.filter((event) => event.equipmentId === equipmentId)
    const downtimeMinutes = related.reduce((total, event) => {
      const start = new Date(event.startedAt)
      const end = event.endedAt ? new Date(event.endedAt) : now
      return total + clampMinutes(start, end, windowStart, windowEnd)
    }, 0)
    const failures = related.length
    const runMinutes = Math.max(0, availablePerEquipment - downtimeMinutes)
    return {
      equipmentId, equipmentName: text(row.equipment_name), area: text(row.current_area), downtimeMinutes, failureCount: failures, runMinutes,
      downtimeRate: availablePerEquipment ? downtimeMinutes / availablePerEquipment * 100 : 0,
      mtbfMinutes: failures ? runMinutes / failures : 0,
      mttrMinutes: failures ? downtimeMinutes / failures : 0,
      days: [...new Set(related.map((event) => new Date(event.startedAt).getDate()))].toSorted((a, b) => a - b),
    }
  }).filter((row) => row.failureCount > 0 || row.downtimeMinutes > 0)

  const totalAvailable = availablePerEquipment * equipmentRows.length
  const downtimeMinutes = byEquipment.reduce((sum, row) => sum + row.downtimeMinutes, 0)
  const failureCount = byEquipment.reduce((sum, row) => sum + row.failureCount, 0)
  const runMinutes = Math.max(0, totalAvailable - downtimeMinutes)
  const causeMap = new Map<string, { count: number; minutes: number }>()
  for (const event of events) {
    const start = new Date(event.startedAt); const end = event.endedAt ? new Date(event.endedAt) : now
    const minutes = clampMinutes(start, end, windowStart, windowEnd)
    const key = event.causeCategory || 'UNCLASSIFIED'
    const current = causeMap.get(key) || { count: 0, minutes: 0 }
    causeMap.set(key, { count: current.count + 1, minutes: current.minutes + minutes })
  }

  return {
    month, trackedDays, totalAvailableMinutesPerEquipment: availablePerEquipment, productionEquipmentCount: equipmentRows.length,
    downtimeMinutes, failureCount, runMinutes,
    downtimeRate: totalAvailable ? downtimeMinutes / totalAvailable * 100 : 0,
    mtbfMinutes: failureCount ? runMinutes / failureCount : 0,
    mttrMinutes: failureCount ? downtimeMinutes / failureCount : 0,
    byEquipment: byEquipment.toSorted((a, b) => b.downtimeMinutes - a.downtimeMinutes),
    byCause: [...causeMap.entries()].map(([cause, value]) => ({ cause, ...value })).toSorted((a, b) => b.minutes - a.minutes),
    events: events.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt)),
  }
}

export async function upsertDowntimeEvent(input: DowntimeInput) {
  const { data, error } = await supabase.rpc('rpc_upsert_downtime_event_bm06', { p_input: input })
  if (error) throw error
  return data as { downtimeId: string; equipmentId: string }
}
