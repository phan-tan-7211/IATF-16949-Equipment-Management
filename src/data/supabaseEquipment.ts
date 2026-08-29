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

function safeFileName(name: string) {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-')
  return cleaned || 'photo.jpg'
}

function optimizedFileName(name: string) {
  const safe = safeFileName(name)
  const base = safe.replace(/\.[^.]+$/, '') || 'photo'
  return `${base}.webp`
}

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
    // Revoked after decode; decoded pixels remain available to canvas.
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

  // For an already tiny source, do not replace it with a larger optimized file.
  if (file.size <= PHOTO_TARGET_BYTES && blob.size >= file.size && scale === 1) {
    return file
  }

  return new File([blob], optimizedFileName(file.name), {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}

export async function uploadEquipmentPhoto(equipmentId: string, file: File) {
  const client = requireSupabase()
  if (!equipmentId.trim()) throw new Error('EQUIPMENT_ID_REQUIRED')

  // Every frontend upload is normalized here before it reaches Supabase Storage.
  const optimizedFile = await optimizeEquipmentPhoto(file)
  const path = `${equipmentId}/${Date.now()}-${safeFileName(optimizedFile.name)}`
  const { error } = await client.storage.from('equipment-photos').upload(path, optimizedFile, {
    cacheControl: '31536000',
    upsert: false,
    contentType: optimizedFile.type,
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
