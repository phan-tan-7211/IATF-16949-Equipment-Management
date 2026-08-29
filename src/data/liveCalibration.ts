import { supabase } from './supabaseClient'

export type CalibrationLinkState = 'LINKED' | 'UNLINKED' | 'ORPHAN' | 'INVALID_TYPE'

export type LiveCalibration = {
  calibrationEquipmentId: string
  equipmentId: string
  controlNumber: string
  department: string
  category: string
  instrumentName: string
  localName: string
  specification: string
  accuracy: string
  model: string
  manufacturer: string
  serialNumber: string
  lastCalibrationDate: string
  nextDueDate: string
  instrumentStatus: string
  active: boolean
  linkState: CalibrationLinkState
}

export type LiveCalibrationLog = {
  calibrationLogId: string
  equipmentId: string
  calibrationDate: string
  nextDueDate: string
  result: string
  actorEmail: string
  provider: string
  note: string
  certificatePath: string
  certificateUrl: string
  createdAt: string
}

type EquipmentIdentity = {
  equipmentId: string
  equipmentType: string
  controlNumber: string
  department: string
  equipmentName: string
  model: string
  manufacturer: string
  serialNumber: string
  sourceData: Record<string, unknown>
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }

function toEquipment(row: Record<string, unknown>): EquipmentIdentity {
  return {
    equipmentId: text(row.equipment_id), equipmentType: text(row.equipment_type), controlNumber: text(row.control_number), department: text(row.department), equipmentName: text(row.equipment_name), model: text(row.model), manufacturer: text(row.manufacturer), serialNumber: text(row.serial_number), sourceData: (row.source_data as Record<string, unknown> | null) || {},
  }
}

export async function loadLiveCalibration(): Promise<LiveCalibration[]> {
  const [calibrationResult, equipmentResult] = await Promise.all([
    supabase.from('calibration_master').select('*').order('equipment_id'),
    supabase.from('equipment_master').select('*'),
  ])
  if (calibrationResult.error) throw calibrationResult.error
  if (equipmentResult.error) throw equipmentResult.error

  const equipmentMap = new Map<string, EquipmentIdentity>()
  ;((equipmentResult.data || []) as Array<Record<string, unknown>>).forEach((row) => {
    const equipment = toEquipment(row)
    if (equipment.equipmentId) equipmentMap.set(equipment.equipmentId, equipment)
  })

  return ((calibrationResult.data || []) as Array<Record<string, unknown>>).map((row) => {
    const equipmentId = text(row.equipment_id)
    const equipment = equipmentMap.get(equipmentId)
    const source = ((row.source_data as Record<string, unknown> | null) || {})
    const linkState: CalibrationLinkState = !equipmentId ? 'UNLINKED' : !equipment ? 'ORPHAN' : equipment.equipmentType === 'MEASUREMENT' ? 'LINKED' : 'INVALID_TYPE'
    return {
      calibrationEquipmentId: text(row.calibration_id), equipmentId,
      controlNumber: equipment?.controlNumber || text(source.controlNumber), department: equipment?.department || text(source.department), category: text(equipment?.sourceData.classification || source.category), instrumentName: equipment?.equipmentName || text(source.instrumentName), localName: text(equipment?.sourceData.description || source.localName), specification: text(equipment?.sourceData.specification || source.specification), accuracy: text(equipment?.sourceData.accuracy || source.accuracy), model: equipment?.model || text(source.model), manufacturer: equipment?.manufacturer || text(source.manufacturer), serialNumber: equipment?.serialNumber || text(source.serialNumber), lastCalibrationDate: text(row.last_calibration_date), nextDueDate: text(row.next_due_date), instrumentStatus: text(row.status), active: Boolean(equipment), linkState,
    }
  })
}

export async function loadCalibrationLogs(equipmentId: string): Promise<LiveCalibrationLog[]> {
  const { data, error } = await supabase.from('calibration_log').select('*').eq('equipment_id', equipmentId).order('calibration_date', { ascending: false }).limit(50)
  if (error) throw error
  const rows = (data || []) as Array<Record<string, unknown>>
  return Promise.all(rows.map(async (row) => {
    const source = (row.source_data as Record<string, unknown> | null) || {}
    const certificatePath = text(source.certificatePath)
    let certificateUrl = ''
    if (certificatePath) {
      const signed = await supabase.storage.from('calibration-certificates').createSignedUrl(certificatePath, 3600)
      if (!signed.error) certificateUrl = signed.data.signedUrl
    }
    return {
      calibrationLogId: text(row.calibration_log_id), equipmentId: text(row.equipment_id), calibrationDate: text(row.calibration_date), nextDueDate: text(row.next_due_date), result: text(row.result), actorEmail: text(row.actor_email), provider: text(source.provider), note: text(source.note), certificatePath, certificateUrl, createdAt: text(row.created_at),
    }
  }))
}

async function uploadCalibrationCertificate(equipmentId: string, file: File) {
  if (file.size > 15 * 1024 * 1024) throw new Error('CERTIFICATE_TOO_LARGE_MAX_15MB')
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'bin' : 'bin'
  const path = `${equipmentId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('calibration-certificates').upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error
  return path
}

export async function recordCalibration(input: {
  equipmentId: string
  calibrationDate: string
  nextDueDate: string
  result: 'PASS' | 'FAIL' | 'LIMITED_USE'
  provider: string
  note: string
  certificate?: File
}) {
  let certificatePath = ''
  try {
    if (input.certificate) certificatePath = await uploadCalibrationCertificate(input.equipmentId, input.certificate)
    const { data, error } = await supabase.rpc('rpc_record_calibration', {
      p_equipment_id: input.equipmentId,
      p_calibration_date: input.calibrationDate,
      p_next_due_date: input.nextDueDate,
      p_result: input.result,
      p_provider: input.provider.trim(),
      p_certificate_path: certificatePath,
      p_note: input.note.trim(),
    })
    if (error) throw error
    return data as Record<string, unknown>
  } catch (cause) {
    if (certificatePath) await supabase.storage.from('calibration-certificates').remove([certificatePath])
    throw cause
  }
}
