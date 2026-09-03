import { supabase } from './supabaseClient'

const PHOTO_BUCKET = 'equipment-photos'

type DeleteBlocker = {
  label: string
  relation: string
  count: number
}

export type EquipmentDeleteCheck = {
  exists: boolean
  canDelete: boolean
  equipmentId: string
  blockers: DeleteBlocker[]
}

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

function normalizeCheck(value: unknown): EquipmentDeleteCheck {
  const row = (value || {}) as Record<string, unknown>
  const rawBlockers = Array.isArray(row.blockers) ? row.blockers : []
  return {
    exists: row.exists === true,
    canDelete: row.canDelete === true,
    equipmentId: String(row.equipmentId || ''),
    blockers: rawBlockers.map((item) => {
      const blocker = (item || {}) as Record<string, unknown>
      return {
        label: String(blocker.label || blocker.relation || 'Dữ liệu liên quan'),
        relation: String(blocker.relation || ''),
        count: Number(blocker.count || 0),
      }
    }).filter((item) => item.count > 0),
  }
}

export async function checkEquipmentDeletion(equipmentId: string) {
  const client = requireSupabase()
  const id = equipmentId.trim().toUpperCase()
  if (!id) throw new Error('EQUIPMENT_ID_REQUIRED')
  const { data, error } = await client.rpc('rpc_check_equipment_delete', { p_equipment_id: id })
  if (error) throw new Error(`EQUIPMENT_DELETE_CHECK_FAILED: ${error.message}`)
  return normalizeCheck(data)
}

async function removeEquipmentPhotos(equipmentId: string) {
  const client = requireSupabase()
  const id = equipmentId.trim().toUpperCase()
  const { data, error } = await client.storage.from(PHOTO_BUCKET).list(id, { limit: 100 })
  if (error) throw new Error(`EQUIPMENT_PHOTO_DELETE_LIST_FAILED: ${error.message}`)
  const paths = (data || []).map((file) => `${id}/${file.name}`)
  if (!paths.length) return 0
  const { error: removeError } = await client.storage.from(PHOTO_BUCKET).remove(paths)
  if (removeError) throw new Error(`EQUIPMENT_PHOTO_DELETE_FAILED: ${removeError.message}`)
  return paths.length
}

export async function deleteUnusedEquipment(equipmentId: string) {
  const client = requireSupabase()
  const id = equipmentId.trim().toUpperCase()
  if (!id) throw new Error('EQUIPMENT_ID_REQUIRED')

  // DB function re-checks dependencies immediately before deletion.
  const { data, error } = await client.rpc('rpc_delete_unused_equipment', { p_equipment_id: id })
  if (error) throw new Error(`EQUIPMENT_DELETE_FAILED: ${error.message}`)

  // Storage is outside the DB transaction, so clean the whole equipment folder after the guarded DB delete.
  const removedPhotos = await removeEquipmentPhotos(id)
  return { ...(data || {}), removedPhotos }
}
