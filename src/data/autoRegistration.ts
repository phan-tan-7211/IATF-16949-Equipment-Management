import { supabase } from './supabaseClient'

export type EquipmentRegistrationInput = {
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  equipmentCategory?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  department?: string
  currentArea?: string
  currentLine?: string
  managingDepartment?: string
  technicalSpecification?: string
  status?: string
  criticality?: 'A' | 'B' | 'C' | 'D' | ''
}

export type EquipmentRegistrationResult = {
  equipmentId: string
  qrCode: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
}

export async function createEquipmentAuto(input: EquipmentRegistrationInput): Promise<EquipmentRegistrationResult> {
  const { data, error } = await supabase.rpc('rpc_create_equipment_auto', { p_input: input })
  if (error) throw error
  const row = (data || {}) as Record<string, unknown>
  return {
    equipmentId: String(row.equipmentId || row.equipment_id || ''),
    qrCode: String(row.qrCode || row.qr_code || ''),
    equipmentType: String(row.equipmentType || row.equipment_type || input.equipmentType) as EquipmentRegistrationResult['equipmentType'],
    equipmentName: String(row.equipmentName || row.equipment_name || input.equipmentName),
  }
}
