import { supabase } from './supabaseClient'

const PHOTO_BUCKET = 'equipment-photos'

export async function deleteEquipmentPhotos(equipmentId: string) {
  const normalizedId = equipmentId.trim().toUpperCase()
  if (!normalizedId) throw new Error('EQUIPMENT_ID_REQUIRED')

  const { data, error: listError } = await supabase.storage.from(PHOTO_BUCKET).list(normalizedId, { limit: 100 })
  if (listError) throw new Error(`SUPABASE_PHOTO_LIST_FAILED: ${listError.message}`)

  const paths = (data || []).map((file) => `${normalizedId}/${file.name}`)
  if (paths.length === 0) return 0

  const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(paths)
  if (removeError) throw new Error(`SUPABASE_PHOTO_DELETE_FAILED: ${removeError.message}`)
  return paths.length
}
