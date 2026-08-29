import type {
  AppsScriptBridgeClient,
  DailyInspectionMark,
  DailyInspectionShift,
  WorkOrderPriority,
} from './appsScriptBridgeClient'

export type InspectionEquipmentOption = {
  equipmentId: string
  equipmentName: string
  currentArea: string
  currentLine: string
}

export type LiveInspection = {
  inspectionId: string
  equipmentId: string
  inspectionDate: string
  shift: string
  area: string
  inspectorId: string
  overallMark: string
  note: string
  damagedParts: string
  createdAt: string
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function normalizeInspectionEquipment(rows: Array<Record<string, unknown>>): InspectionEquipmentOption[] {
  return rows
    .filter((row) => text(row.equipmentId) && text(row.equipmentType) === 'PRODUCTION' && text(row.status) !== 'DISPOSED')
    .map((row) => ({
      equipmentId: text(row.equipmentId),
      equipmentName: text(row.equipmentName),
      currentArea: text(row.currentArea),
      currentLine: text(row.currentLine),
    }))
    .sort((a, b) => a.equipmentId.localeCompare(b.equipmentId))
}

export function normalizeInspections(rows: Array<Record<string, unknown>>): LiveInspection[] {
  return rows
    .filter((row) => text(row.inspectionId))
    .map((row) => ({
      inspectionId: text(row.inspectionId),
      equipmentId: text(row.equipmentId),
      inspectionDate: text(row.inspectionDate),
      shift: text(row.shift),
      area: text(row.area),
      inspectorId: text(row.inspectorId),
      overallMark: text(row.overallMark),
      note: text(row.note),
      damagedParts: text(row.damagedParts),
      createdAt: text(row.createdAt),
    }))
    .sort((a, b) => (b.createdAt || b.inspectionDate).localeCompare(a.createdAt || a.inspectionDate))
}

export async function loadLiveInspection(client: Pick<AppsScriptBridgeClient, 'readTable'>) {
  const [equipmentRows, inspectionRows] = await Promise.all([
    client.readTable<Record<string, unknown>>('Equipment_Master'),
    client.readTable<Record<string, unknown>>('Daily_Inspection'),
  ])
  return {
    equipment: normalizeInspectionEquipment(equipmentRows),
    inspections: normalizeInspections(inspectionRows),
  }
}

export async function submitLiveInspection(
  client: Pick<AppsScriptBridgeClient, 'submitDailyInspection'>,
  request: {
    operationId: string
    equipmentId: string
    shift: DailyInspectionShift
    area: string
    overallMark: DailyInspectionMark
    note: string
    damagedParts: string
    priority: WorkOrderPriority
  },
) {
  return client.submitDailyInspection({
    operationId: request.operationId,
    input: {
      equipmentId: request.equipmentId,
      shift: request.shift,
      area: request.area,
      overallMark: request.overallMark,
      note: request.note,
      damagedParts: request.damagedParts,
      priority: request.priority,
    },
  })
}
