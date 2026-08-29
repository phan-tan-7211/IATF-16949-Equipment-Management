import type { LiveEquipment } from './liveEquipment'
import { supabase } from './supabaseClient'

function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

function sourceText(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return ''
  const value = (source as Record<string, unknown>)[key]
  return value === null || value === undefined ? '' : String(value).trim()
}

export async function loadSupabaseEquipment(): Promise<LiveEquipment[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('equipment_master')
    .select('equipment_id,equipment_type,equipment_name,manufacturer,model,serial_number,department,status,active,qr_code,updated_at,source_data')
    .order('equipment_id')

  if (error) throw new Error(`SUPABASE_EQUIPMENT_READ_FAILED: ${error.message}`)

  return (data || []).map((row) => {
    const source = row.source_data
    return {
      equipmentId: String(row.equipment_id || ''),
      equipmentName: String(row.equipment_name || row.equipment_id || ''),
      equipmentType: row.equipment_type as LiveEquipment['equipmentType'],
      equipmentCategory: sourceText(source, 'equipmentCategory'),
      manufacturer: String(row.manufacturer || ''),
      model: String(row.model || ''),
      serialNumber: String(row.serial_number || ''),
      currentArea: sourceText(source, 'currentArea'),
      currentLine: sourceText(source, 'currentLine'),
      managingDepartment: sourceText(source, 'managingDepartment'),
      usingDepartment: String(row.department || sourceText(source, 'usingDepartment')),
      technicalSpecification: sourceText(source, 'technicalSpecification'),
      status: String(row.status || 'UNKNOWN'),
      criticality: sourceText(source, 'criticality'),
      qrCode: String(row.qr_code || row.equipment_id || ''),
      active: Boolean(row.active),
      updatedAt: String(row.updated_at || ''),
    }
  })
}

function safeFileName(name: string) {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-')
  return cleaned || 'photo.jpg'
}

export async function uploadEquipmentPhoto(equipmentId: string, file: File) {
  const client = requireSupabase()
  if (!equipmentId.trim()) throw new Error('EQUIPMENT_ID_REQUIRED')
  if (!file.type.startsWith('image/')) throw new Error('IMAGE_FILE_REQUIRED')
  if (file.size > 5 * 1024 * 1024) throw new Error('IMAGE_TOO_LARGE_MAX_5MB')

  const path = `${equipmentId}/${Date.now()}-${safeFileName(file.name)}`
  const { error } = await client.storage.from('equipment-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw new Error(`SUPABASE_PHOTO_UPLOAD_FAILED: ${error.message}`)
  return path
}

export async function listEquipmentPhotos(equipmentId: string) {
  const client = requireSupabase()
  const { data, error } = await client.storage.from('equipment-photos').list(equipmentId, {
    limit: 20,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw new Error(`SUPABASE_PHOTO_LIST_FAILED: ${error.message}`)
  return data || []
}
