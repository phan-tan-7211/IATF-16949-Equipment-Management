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

export type EquipmentEditInput = {
  oldEquipmentId: string
  equipmentId: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentName: string
  department: string
  model: string
  serialNumber: string
  status: string
}

export type EquipmentPhotoPreview = {
  exists: boolean
  path: string
  signedUrl: string
}

export type EquipmentHistory = {
  calibration: Array<Record<string, unknown>>
  maintenance: Array<Record<string, unknown>>
  inspections: Array<Record<string, unknown>>
  downtime: Array<Record<string, unknown>>
  movements: Array<Record<string, unknown>>
  audit: Array<Record<string, unknown>>
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

export async function loadEquipmentHistory(equipmentId: string): Promise<EquipmentHistory> {
  const client = requireSupabase()
  const id = equipmentId.trim()
  if (!id) throw new Error('EQUIPMENT_ID_REQUIRED')

  const [calibration, maintenance, inspections, downtime, movements, audit] = await Promise.all([
    client.from('calibration_log').select('calibration_log_id,calibration_date,next_due_date,result,actor_email,created_at,source_data').eq('equipment_id', id).order('calibration_date', { ascending: false }).limit(50),
    client.from('maintenance_work_order').select('work_order_id,status,priority,reason,source_type,source_id,created_by,created_at,updated_at,source_data').eq('equipment_id', id).order('created_at', { ascending: false }).limit(50),
    client.from('daily_inspection').select('inspection_id,inspection_date,shift,area,overall_mark,note,actor_email,created_at,source_data').eq('equipment_id', id).order('inspection_date', { ascending: false }).limit(50),
    client.from('downtime_event').select('downtime_id,work_order_id,started_at,ended_at,created_at,source_data').eq('equipment_id', id).order('started_at', { ascending: false }).limit(50),
    client.from('equipment_movement_log').select('movement_id,from_location,to_location,actor_email,created_at,source_data').eq('equipment_id', id).order('created_at', { ascending: false }).limit(50),
    client.from('audit_log').select('audit_id,entity_type,entity_id,action,actor_email,detail,created_at').eq('equipment_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  const failures = [calibration, maintenance, inspections, downtime, movements, audit].filter((result) => result.error)
  if (failures.length > 0) throw new Error(`SUPABASE_EQUIPMENT_HISTORY_FAILED: ${failures[0].error?.message}`)

  return {
    calibration: (calibration.data || []) as Array<Record<string, unknown>>,
    maintenance: (maintenance.data || []) as Array<Record<string, unknown>>,
    inspections: (inspections.data || []) as Array<Record<string, unknown>>,
    downtime: (downtime.data || []) as Array<Record<string, unknown>>,
    movements: (movements.data || []) as Array<Record<string, unknown>>,
    audit: (audit.data || []) as Array<Record<string, unknown>>,
  }
}

export async function updateSupabaseEquipment(input: EquipmentEditInput) {
  const client = requireSupabase()
  const payload = {
    p_old_equipment_id: input.oldEquipmentId.trim(),
    p_equipment_id: input.equipmentId.trim(),
    p_equipment_type: input.equipmentType,
    p_equipment_name: input.equipmentName.trim(),
    p_model: input.model.trim(),
    p_serial_number: input.serialNumber.trim(),
    p_department: input.department.trim(),
    p_status: input.status.trim() || 'RUNNING',
  }

  const { error } = await client.rpc('admin_update_equipment', payload)
  if (error) throw new Error(`SUPABASE_EQUIPMENT_SAVE_FAILED: ${error.message}`)
}

const PHOTO_MAX_INPUT_BYTES = 25 * 1024 * 1024
const PHOTO_MAX_EDGE = 1920
const PHOTO_TARGET_BYTES = 1.5 * 1024 * 1024
const PHOTO_INITIAL_QUALITY = 0.82
const PHOTO_MIN_QUALITY = 0.66
const EQUIPMENT_PHOTO_NAME = 'photo.webp'

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('IMAGE_COMPRESSION_FAILED')),
      'image/webp',
      quality,
    )
  })
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function optimizeEquipmentPhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('IMAGE_FILE_REQUIRED')
  if (file.size > PHOTO_MAX_INPUT_BYTES) throw new Error('IMAGE_TOO_LARGE_MAX_25MB')

  const image = await loadImage(file)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('IMAGE_DIMENSIONS_INVALID')

  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new Error('IMAGE_CANVAS_UNAVAILABLE')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)

  let quality = PHOTO_INITIAL_QUALITY
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > PHOTO_TARGET_BYTES && quality > PHOTO_MIN_QUALITY) {
    quality = Math.max(PHOTO_MIN_QUALITY, quality - 0.04)
    blob = await canvasToBlob(canvas, quality)
  }

  return new File([blob], EQUIPMENT_PHOTO_NAME, {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}

export async function listEquipmentPhotos(equipmentId: string) {
  const client = requireSupabase()
  const { data, error } = await client.storage.from('equipment-photos').list(equipmentId, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw new Error(`SUPABASE_PHOTO_LIST_FAILED: ${error.message}`)
  return data || []
}

export async function getEquipmentPhotoPreview(equipmentId: string): Promise<EquipmentPhotoPreview> {
  const client = requireSupabase()
  const normalizedId = equipmentId.trim()
  if (!normalizedId) return { exists: false, path: '', signedUrl: '' }

  const files = await listEquipmentPhotos(normalizedId)
  const canonical = files.find((file) => file.name === EQUIPMENT_PHOTO_NAME)
  const selected = canonical || files[0]
  if (!selected) return { exists: false, path: '', signedUrl: '' }

  const path = `${normalizedId}/${selected.name}`
  const { data, error } = await client.storage.from('equipment-photos').createSignedUrl(path, 3600)
  if (error) throw new Error(`SUPABASE_PHOTO_URL_FAILED: ${error.message}`)
  return { exists: true, path, signedUrl: data.signedUrl }
}

export async function hasEquipmentPhoto(equipmentId: string) {
  const preview = await getEquipmentPhotoPreview(equipmentId)
  return preview.exists
}

export async function uploadEquipmentPhoto(equipmentId: string, file: File) {
  const client = requireSupabase()
  const normalizedId = equipmentId.trim()
  if (!normalizedId) throw new Error('EQUIPMENT_ID_REQUIRED')

  const optimizedFile = await optimizeEquipmentPhoto(file)
  const path = `${normalizedId}/${EQUIPMENT_PHOTO_NAME}`

  const { error } = await client.storage.from('equipment-photos').upload(path, optimizedFile, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'image/webp',
  })
  if (error) throw new Error(`SUPABASE_PHOTO_UPLOAD_FAILED: ${error.message}`)

  const files = await listEquipmentPhotos(normalizedId)
  const stalePaths = files
    .filter((item) => item.name !== EQUIPMENT_PHOTO_NAME)
    .map((item) => `${normalizedId}/${item.name}`)
  if (stalePaths.length > 0) {
    const { error: removeError } = await client.storage.from('equipment-photos').remove(stalePaths)
    if (removeError) throw new Error(`SUPABASE_PHOTO_CLEANUP_FAILED: ${removeError.message}`)
  }

  return path
}
