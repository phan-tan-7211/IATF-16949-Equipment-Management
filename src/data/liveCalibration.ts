import type { AppsScriptBridgeClient } from './appsScriptBridgeClient'

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
  equipmentId?: unknown
  equipmentType?: unknown
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function bool(value: unknown) {
  if (typeof value === 'boolean') return value
  const normalized = text(value).toUpperCase()
  return normalized === 'TRUE' || normalized === '1' || normalized === 'YES'
}

export function resolveCalibrationLinkState(equipmentId: string, equipmentMap: Map<string, EquipmentIdentity>): CalibrationLinkState {
  if (!equipmentId) return 'UNLINKED'
  const equipment = equipmentMap.get(equipmentId)
  if (!equipment) return 'ORPHAN'
  return text(equipment.equipmentType) === 'MEASUREMENT' ? 'LINKED' : 'INVALID_TYPE'
}

export function normalizeCalibrationRows(
  rows: Array<Record<string, unknown>>,
  equipmentRows: Array<Record<string, unknown>>,
): LiveCalibration[] {
  const equipmentMap = new Map<string, EquipmentIdentity>()
  equipmentRows.forEach((row) => {
    const equipmentId = text(row.equipmentId)
    if (equipmentId) equipmentMap.set(equipmentId, row)
  })

  return rows
    .map((row) => {
      const calibrationEquipmentId = text(row.calibrationEquipmentId)
      const equipmentId = text(row.equipmentId)
      return {
        calibrationEquipmentId,
        equipmentId,
        controlNumber: text(row.controlNumber),
        department: text(row.department),
        category: text(row.category),
        instrumentName: text(row.instrumentName),
        localName: text(row.localName),
        specification: text(row.specification),
        accuracy: text(row.accuracy),
        model: text(row.model),
        manufacturer: text(row.manufacturer),
        serialNumber: text(row.serialNumber),
        lastCalibrationDate: text(row.lastCalibrationDate),
        nextDueDate: text(row.nextDueDate),
        instrumentStatus: text(row.instrumentStatus),
        active: bool(row.active),
        linkState: resolveCalibrationLinkState(equipmentId, equipmentMap),
      }
    })
    .filter((row) => row.calibrationEquipmentId)
}

export async function loadLiveCalibration(client: Pick<AppsScriptBridgeClient, 'readTable'>) {
  const [calibrationRows, equipmentRows] = await Promise.all([
    client.readTable<Record<string, unknown>>('Calibration_Master'),
    client.readTable<Record<string, unknown>>('Equipment_Master'),
  ])
  return normalizeCalibrationRows(calibrationRows, equipmentRows)
}
