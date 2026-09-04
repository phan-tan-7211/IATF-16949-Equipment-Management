import type { LiveEquipment } from './liveEquipment'
import { patchEquipmentCacheAfterBulk, patchEquipmentCacheAfterWrite } from './supabaseEquipment'
import { supabase } from './supabaseClient'

export type EquipmentBulkPatch = {
  department?: string
  managingDepartment?: string
  currentArea?: string
  currentLine?: string
  equipmentCategory?: string
  status?: string
}

export type EquipmentRowPatch = Partial<{
  equipmentName: string
  equipmentCategory: string
  manufacturer: string
  distributor: string
  model: string
  serialNumber: string
  department: string
  managingDepartment: string
  managementResponsiblePrimary: string
  managementResponsibleSecondary: string
  currentArea: string
  currentLine: string
  status: string
  defaultLabelSize: 'tiny' | 'standard' | 'large'
  technicalSpecification: string
  description: string
  accuracy: string
  controlsProductQuality: boolean
  specialCharacteristicImpact: boolean
  stopsProduction: boolean
  hasBackup: boolean
  capacityImpact: boolean
  origin: string
  manufactureDate: string
  inServiceDate: string
  warrantyUntil: string
  warrantyContact: string
  note: string
  relatedDocuments: string
  active: boolean
}>

export type EquipmentRowChange = { equipmentId: string; patch: EquipmentRowPatch }

export async function bulkUpdateEquipment(equipmentIds: string[], patch: EquipmentBulkPatch) {
  const ids = [...new Set(equipmentIds.map((id) => id.trim().toUpperCase()).filter(Boolean))]
  if (!ids.length) throw new Error('Chưa chọn thiết bị.')
  if (!Object.keys(patch).length) throw new Error('Chưa chọn nội dung cần cập nhật.')

  const normalizedPatch = Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
  const { data, error } = await supabase.rpc('rpc_bulk_update_equipment_master', {
    p_equipment_ids: ids,
    p_patch: normalizedPatch,
  })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_BULK_UPDATE_FAILED: ${error.message}`)
  const result = (data || {}) as Record<string, unknown>
  patchEquipmentCacheAfterBulk(ids, normalizedPatch)
  return { updatedCount: Number(result.updatedCount || result.updated_count || 0) }
}

function cachePatch(change: EquipmentRowChange): Partial<LiveEquipment> & { equipmentId: string; department?: string } {
  const patch = change.patch
  return {
    equipmentId: change.equipmentId,
    equipmentName: patch.equipmentName,
    equipmentCategory: patch.equipmentCategory,
    manufacturer: patch.manufacturer,
    distributor: patch.distributor,
    model: patch.model,
    serialNumber: patch.serialNumber,
    department: patch.department,
    managingDepartment: patch.managingDepartment,
    managementResponsiblePrimary: patch.managementResponsiblePrimary,
    managementResponsibleSecondary: patch.managementResponsibleSecondary,
    currentArea: patch.currentArea,
    currentLine: patch.currentLine,
    status: patch.status,
    defaultLabelSize: patch.defaultLabelSize,
    technicalSpecification: patch.technicalSpecification,
    description: patch.description,
    accuracy: patch.accuracy,
    origin: patch.origin,
    manufactureDate: patch.manufactureDate,
    inServiceDate: patch.inServiceDate,
    warrantyUntil: patch.warrantyUntil,
    warrantyContact: patch.warrantyContact,
    note: patch.note,
    relatedDocuments: patch.relatedDocuments,
    active: patch.active,
    criticalityFacts: Object.keys(patch).some((key) => ['controlsProductQuality','specialCharacteristicImpact','stopsProduction','hasBackup','capacityImpact'].includes(key)) ? {
      controlsProductQuality: patch.controlsProductQuality,
      specialCharacteristicImpact: patch.specialCharacteristicImpact,
      stopsProduction: patch.stopsProduction,
      hasBackup: patch.hasBackup,
      capacityImpact: patch.capacityImpact,
    } : undefined,
  }
}

export async function bulkUpdateEquipmentRows(changes: EquipmentRowChange[]) {
  const normalized = changes
    .map((change) => ({
      equipmentId: change.equipmentId.trim().toUpperCase(),
      ...Object.fromEntries(Object.entries(change.patch).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])),
    }))
    .filter((change) => change.equipmentId && Object.keys(change).length > 1)
  if (!normalized.length) throw new Error('Chưa có ô nào thay đổi.')

  const { data, error } = await supabase.rpc('rpc_bulk_update_equipment_rows', { p_changes: normalized })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_ROW_BATCH_UPDATE_FAILED: ${error.message}`)
  for (const change of changes) patchEquipmentCacheAfterWrite(cachePatch(change))
  const result = (data || {}) as Record<string, unknown>
  return { updatedCount: Number(result.updatedCount || result.updated_count || normalized.length) }
}
