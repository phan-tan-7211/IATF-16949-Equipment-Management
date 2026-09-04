import type { EquipmentCriticalityFacts, EquipmentCriticality } from './autoRegistration'
import { deriveEquipmentCriticality } from './autoRegistration'
import type { EquipmentMasterTextFields } from './equipmentMasterFields'
import { supabase } from './supabaseClient'

export type EquipmentMasterEditInput = EquipmentCriticalityFacts & EquipmentMasterTextFields & {
  equipmentId: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  status: string
}

export type EquipmentMasterEditResult = {
  equipmentId: string
  criticality: EquipmentCriticality
}

export async function updateEquipmentDetails(input: EquipmentMasterEditInput): Promise<EquipmentMasterEditResult> {
  const criticality = deriveEquipmentCriticality(input)
  if (!criticality) throw new Error('Vui lòng trả lời đủ 5 câu để hệ thống tự xác định cấp độ thiết bị.')
  if (!input.equipmentId.trim()) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (!input.equipmentName.trim()) throw new Error('EQUIPMENT_NAME_REQUIRED')

  const { equipmentId, equipmentType: _equipmentType, ...payload } = input
  const { data, error } = await supabase.rpc('rpc_update_equipment_details', {
    p_equipment_id: equipmentId.trim(),
    p_input: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])),
  })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_SAVE_FAILED: ${error.message}`)
  const row = (data || {}) as Record<string, unknown>
  return {
    equipmentId: String(row.equipmentId || row.equipment_id || equipmentId),
    criticality: String(row.criticality || criticality) as EquipmentCriticality,
  }
}
