import { supabase } from './supabaseClient'
import type { EquipmentMasterTextFields } from './equipmentMasterFields'

export type EquipmentCriticality = 'A' | 'B' | 'C' | 'D'

export type EquipmentCriticalityFacts = {
  controlsProductQuality?: boolean
  specialCharacteristicImpact?: boolean
  stopsProduction?: boolean
  hasBackup?: boolean
  capacityImpact?: boolean
}

export type EquipmentRegistrationInput = EquipmentCriticalityFacts & Partial<EquipmentMasterTextFields> & {
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  status?: string
}

export type EquipmentRegistrationResult = {
  equipmentId: string
  qrCode: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  criticality: EquipmentCriticality
}

export function deriveEquipmentCriticality(facts: EquipmentCriticalityFacts): EquipmentCriticality | '' {
  const {
    controlsProductQuality,
    specialCharacteristicImpact,
    stopsProduction,
    hasBackup,
    capacityImpact,
  } = facts

  if (
    typeof controlsProductQuality !== 'boolean'
    || typeof specialCharacteristicImpact !== 'boolean'
    || typeof stopsProduction !== 'boolean'
    || typeof hasBackup !== 'boolean'
    || typeof capacityImpact !== 'boolean'
  ) return ''

  if (specialCharacteristicImpact) return 'A'
  if (!hasBackup && (controlsProductQuality || stopsProduction || capacityImpact)) return 'A'
  if (controlsProductQuality || stopsProduction || capacityImpact) return 'B'
  if (!hasBackup) return 'C'
  return 'D'
}

export async function createEquipmentAuto(input: EquipmentRegistrationInput): Promise<EquipmentRegistrationResult> {
  const criticality = deriveEquipmentCriticality(input)
  if (!criticality) throw new Error('Vui lòng trả lời đủ 5 câu để hệ thống tự xác định mức độ quan trọng của thiết bị.')
  if (!input.managementResponsiblePrimary?.trim()) throw new Error('Vui lòng nhập người phụ trách quản lý chính.')

  const { data, error } = await supabase.rpc('rpc_create_equipment_auto', { p_input: input })
  if (error) throw error
  const row = (data || {}) as Record<string, unknown>
  const equipmentId = String(row.equipmentId || row.equipment_id || '')

  if (equipmentId && input.distributor?.trim()) {
    const { error: distributorError } = await supabase.rpc('rpc_set_equipment_distributor', {
      p_equipment_id: equipmentId,
      p_distributor: input.distributor.trim(),
    })
    if (distributorError) throw new Error(`Thiết bị đã tạo nhưng chưa lưu được nhà phân phối: ${distributorError.message}`)
  }

  return {
    equipmentId,
    qrCode: String(row.qrCode || row.qr_code || ''),
    equipmentType: String(row.equipmentType || row.equipment_type || input.equipmentType) as EquipmentRegistrationResult['equipmentType'],
    equipmentName: String(row.equipmentName || row.equipment_name || input.equipmentName),
    criticality: String(row.criticality || criticality) as EquipmentCriticality,
  }
}
