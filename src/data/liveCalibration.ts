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
    equipmentId: text(row.equipment_id),
    equipmentType: text(row.equipment_type),
    controlNumber: text(row.control_number),
    department: text(row.department),
    equipmentName: text(row.equipment_name),
    model: text(row.model),
    manufacturer: text(row.manufacturer),
    serialNumber: text(row.serial_number),
    sourceData: (row.source_data as Record<string, unknown> | null) || {},
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
      calibrationEquipmentId: text(row.calibration_id),
      equipmentId,
      controlNumber: equipment?.controlNumber || text(source.controlNumber),
      department: equipment?.department || text(source.department),
      category: text(equipment?.sourceData.classification || source.category),
      instrumentName: equipment?.equipmentName || text(source.instrumentName),
      localName: text(equipment?.sourceData.description || source.localName),
      specification: text(equipment?.sourceData.specification || source.specification),
      accuracy: text(equipment?.sourceData.accuracy || source.accuracy),
      model: equipment?.model || text(source.model),
      manufacturer: equipment?.manufacturer || text(source.manufacturer),
      serialNumber: equipment?.serialNumber || text(source.serialNumber),
      lastCalibrationDate: text(row.last_calibration_date),
      nextDueDate: text(row.next_due_date),
      instrumentStatus: text(row.status),
      active: equipment ? true : false,
      linkState,
    }
  })
}
