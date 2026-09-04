import type { EquipmentCriticalityFacts, EquipmentCriticality } from './autoRegistration'
import { deriveEquipmentCriticality } from './autoRegistration'
import { supabase } from './supabaseClient'

export type EquipmentMasterEditInput = EquipmentCriticalityFacts & {
  equipmentId: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  equipmentCategory: string
  manufacturer: string
  model: string
  serialNumber: string
  department: string
  currentArea: string
  currentLine: string
  managingDepartment: string
  technicalSpecification: string
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

  const { data, error } = await supabase.rpc('rpc_update_equipment_details', {
    p_equipment_id: input.equipmentId.trim(),
    p_input: {
      equipmentName: input.equipmentName.trim(),
      equipmentCategory: input.equipmentCategory.trim(),
      manufacturer: input.manufacturer.trim(),
      model: input.model.trim(),
      serialNumber: input.serialNumber.trim(),
      department: input.department.trim(),
      currentArea: input.currentArea.trim(),
      currentLine: input.currentLine.trim(),
      managingDepartment: input.managingDepartment.trim(),
      technicalSpecification: input.technicalSpecification.trim(),
      status: input.status.trim() || 'RUNNING',
      controlsProductQuality: input.controlsProductQuality,
      specialCharacteristicImpact: input.specialCharacteristicImpact,
      stopsProduction: input.stopsProduction,
      hasBackup: input.hasBackup,
      capacityImpact: input.capacityImpact,
    },
  })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_SAVE_FAILED: ${error.message}`)
  const row = (data || {}) as Record<string, unknown>
  return {
    equipmentId: String(row.equipmentId || row.equipment_id || input.equipmentId),
    criticality: String(row.criticality || criticality) as EquipmentCriticality,
  }
}
