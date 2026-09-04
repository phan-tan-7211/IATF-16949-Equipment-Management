import type { EquipmentCriticalityFacts, EquipmentCriticality } from './autoRegistration'
import { deriveEquipmentCriticality } from './autoRegistration'
import type { EquipmentMasterTextFields } from './equipmentMasterFields'
import { patchEquipmentCacheAfterWrite } from './supabaseEquipment'
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
  if (!input.managementResponsiblePrimary?.trim()) throw new Error('Vui lòng nhập người phụ trách quản lý chính.')

  const { equipmentId, equipmentType: _equipmentType, ...payload } = input
  const { data, error } = await supabase.rpc('rpc_update_equipment_details', {
    p_equipment_id: equipmentId.trim(),
    p_input: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])),
  })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_SAVE_FAILED: ${error.message}`)
  const row = (data || {}) as Record<string, unknown>
  const result = {
    equipmentId: String(row.equipmentId || row.equipment_id || equipmentId),
    criticality: String(row.criticality || criticality) as EquipmentCriticality,
  }
  patchEquipmentCacheAfterWrite({
    equipmentId: result.equipmentId,
    equipmentName: input.equipmentName.trim(),
    equipmentType: input.equipmentType,
    equipmentCategory: input.equipmentCategory.trim(),
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    serialNumber: input.serialNumber.trim(),
    currentArea: input.currentArea.trim(),
    currentLine: input.currentLine.trim(),
    managingDepartment: input.managingDepartment.trim(),
    managementResponsiblePrimary: input.managementResponsiblePrimary?.trim() || '',
    managementResponsibleSecondary: input.managementResponsibleSecondary?.trim() || '',
    department: input.department.trim(),
    technicalSpecification: input.technicalSpecification.trim(),
    description: input.description.trim(),
    accuracy: input.accuracy.trim(),
    origin: input.origin.trim(),
    manufactureDate: input.manufactureDate.trim(),
    inServiceDate: input.inServiceDate.trim(),
    warrantyUntil: input.warrantyUntil.trim(),
    warrantyContact: input.warrantyContact.trim(),
    note: input.note.trim(),
    relatedDocuments: input.relatedDocuments.trim(),
    status: input.status.trim() || 'RUNNING',
    criticality: result.criticality,
    criticalityFacts: {
      controlsProductQuality: input.controlsProductQuality,
      specialCharacteristicImpact: input.specialCharacteristicImpact,
      stopsProduction: input.stopsProduction,
      hasBackup: input.hasBackup,
      capacityImpact: input.capacityImpact,
    },
  })
  return result
}
