import type { AppsScriptBridgeClient } from './appsScriptBridgeClient'

export type LiveEquipment = {
  equipmentId: string
  equipmentName: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentCategory: string
  manufacturer: string
  model: string
  serialNumber: string
  currentArea: string
  currentLine: string
  managingDepartment: string
  usingDepartment: string
  technicalSpecification: string
  status: string
  criticality: string
  qrCode: string
  active: boolean
  updatedAt: string
}

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function bool(value: unknown) {
  if (typeof value === 'boolean') return value
  return ['TRUE', '1', 'YES'].includes(text(value).toUpperCase())
}

export function normalizeEquipmentRow(row: Record<string, unknown>): LiveEquipment | null {
  const equipmentId = text(row.equipmentId)
  const equipmentType = text(row.equipmentType).toUpperCase()
  if (!equipmentId || !['PRODUCTION', 'MEASUREMENT'].includes(equipmentType)) return null

  return {
    equipmentId,
    equipmentName: text(row.equipmentName) || equipmentId,
    equipmentType: equipmentType as LiveEquipment['equipmentType'],
    equipmentCategory: text(row.equipmentCategory),
    manufacturer: text(row.manufacturer),
    model: text(row.model),
    serialNumber: text(row.serialNumber),
    currentArea: text(row.currentArea),
    currentLine: text(row.currentLine),
    managingDepartment: text(row.managingDepartment),
    usingDepartment: text(row.usingDepartment),
    technicalSpecification: text(row.technicalSpecification),
    status: text(row.status) || 'RUNNING',
    criticality: text(row.criticality),
    qrCode: text(row.qrCode) || equipmentId,
    active: bool(row.active),
    updatedAt: text(row.updatedAt),
  }
}

export async function loadLiveEquipment(client: Pick<AppsScriptBridgeClient, 'readTable'>) {
  const rows = await client.readTable<Record<string, unknown>>('Equipment_Master')
  return rows.map(normalizeEquipmentRow).filter((row): row is LiveEquipment => Boolean(row))
}
