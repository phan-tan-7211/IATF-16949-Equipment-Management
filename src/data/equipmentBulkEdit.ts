import { supabase } from './supabaseClient'

export type EquipmentBulkPatch = {
  department?: string
  managingDepartment?: string
  currentArea?: string
  currentLine?: string
  equipmentCategory?: string
  status?: string
}

export async function bulkUpdateEquipment(equipmentIds: string[], patch: EquipmentBulkPatch) {
  const ids = [...new Set(equipmentIds.map((id) => id.trim().toUpperCase()).filter(Boolean))]
  if (!ids.length) throw new Error('Chưa chọn thiết bị.')
  if (!Object.keys(patch).length) throw new Error('Chưa chọn nội dung cần cập nhật.')

  const { data, error } = await supabase.rpc('rpc_bulk_update_equipment_master', {
    p_equipment_ids: ids,
    p_patch: Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])),
  })
  if (error) throw new Error(`SUPABASE_EQUIPMENT_BULK_UPDATE_FAILED: ${error.message}`)
  const result = (data || {}) as Record<string, unknown>
  return { updatedCount: Number(result.updatedCount || result.updated_count || 0) }
}
