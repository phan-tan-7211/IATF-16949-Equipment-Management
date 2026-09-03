import { supabase } from './supabaseClient'

export type SpareClassification = 'NORMAL' | 'RECOMMENDED' | 'REQUIRED'

export type SpareEquipmentLink = {
  equipmentId: string
  equipmentName: string
  criticality: string
}

export type LiveSparePart = {
  partId: string
  partName: string
  partNumber: string
  maker: string
  stockQty: number
  minQty: number
  location: string
  leadTimeDays: number | null
  stopsProduction: boolean
  qualitySafetyImpact: boolean
  leadTimeExceedsRecovery: boolean
  rationaleNote: string
  equipmentCount: number
  criticalEquipmentCount: number
  sharedCritical: boolean
  riskScore: number
  classification: SpareClassification
  equipment: SpareEquipmentLink[]
  updatedAt: string
}

export type SpareUsage = {
  usageId: string
  partId: string
  equipmentId: string
  quantity: number
  usedAt: string
  workOrderId: string
  reason: string
  performedBy: string
  actorEmail: string
}

export type SaveSparePartInput = {
  partId: string
  partName: string
  partNumber?: string
  maker?: string
  stockQty: number
  minQty: number
  location?: string
  leadTimeDays?: number | null
  stopsProduction: boolean
  qualitySafetyImpact: boolean
  leadTimeExceedsRecovery: boolean
  rationaleNote?: string
  equipmentIds: string[]
}

function text(value: unknown) { return value === null || value === undefined ? '' : String(value).trim() }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function bool(value: unknown) { return value === true || text(value).toLowerCase() === 'true' }

function normalizeEquipment(value: unknown): SpareEquipmentLink[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = (item || {}) as Record<string, unknown>
    return { equipmentId: text(row.equipmentId), equipmentName: text(row.equipmentName), criticality: text(row.criticality) }
  }).filter((item) => item.equipmentId)
}

function normalizePart(row: Record<string, unknown>): LiveSparePart {
  return {
    partId: text(row.part_id),
    partName: text(row.part_name),
    partNumber: text(row.part_number),
    maker: text(row.maker),
    stockQty: num(row.stock_qty),
    minQty: num(row.min_qty),
    location: text(row.location),
    leadTimeDays: row.lead_time_days === null || row.lead_time_days === undefined ? null : num(row.lead_time_days),
    stopsProduction: bool(row.stops_production),
    qualitySafetyImpact: bool(row.quality_safety_impact),
    leadTimeExceedsRecovery: bool(row.lead_time_exceeds_recovery),
    rationaleNote: text(row.rationale_note),
    equipmentCount: num(row.equipment_count),
    criticalEquipmentCount: num(row.critical_equipment_count),
    sharedCritical: bool(row.shared_critical),
    riskScore: num(row.risk_score),
    classification: (text(row.spare_classification) || 'NORMAL') as SpareClassification,
    equipment: normalizeEquipment(row.equipment),
    updatedAt: text(row.updated_at),
  }
}

export async function loadSpareParts() {
  const { data, error } = await supabase.from('spare_part_overview').select('*').order('part_id')
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map(normalizePart)
}

export async function saveSparePart(input: SaveSparePartInput) {
  const payload = { ...input, leadTimeDays: input.leadTimeDays ?? null }
  const { data, error } = await supabase.rpc('rpc_save_spare_part', { p_input: payload })
  if (error) throw error
  return normalizePart((data || {}) as Record<string, unknown>)
}

export async function loadSpareUsage(partId: string) {
  const { data, error } = await supabase.from('spare_part_usage').select('*').eq('part_id', partId).order('used_at', { ascending: false }).limit(50)
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map((row): SpareUsage => ({
    usageId: text(row.usage_id),
    partId: text(row.part_id),
    equipmentId: text(row.equipment_id),
    quantity: num(row.quantity),
    usedAt: text(row.used_at),
    workOrderId: text(row.work_order_id),
    reason: text(row.reason),
    performedBy: text(row.performed_by),
    actorEmail: text(row.actor_email),
  }))
}

export async function recordSpareUsage(input: { partId: string; equipmentId: string; quantity: number; reason?: string; performedBy?: string; workOrderId?: string }) {
  const { data, error } = await supabase.rpc('rpc_record_spare_usage', { p_input: input })
  if (error) throw error
  return data
}
