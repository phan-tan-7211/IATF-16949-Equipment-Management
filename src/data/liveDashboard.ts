import type { AppsScriptBridgeClient } from './appsScriptBridgeClient'
import { getCalibrationDueStatus } from '../domain/calibration'

export type LiveDashboardSummary = {
  equipmentTotal: number
  productionCount: number
  measurementCount: number
  runningCount: number
  downCount: number
  calibrationTotal: number
  calibrationOverdue: number
  workOrderOpen: number
  criticalOpen: number
  pmOverdue: number
  downtimeOpen: number
  downtimeMinutes: number
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(text(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function summarizeLiveDashboard(input: {
  equipmentRows: Array<Record<string, unknown>>
  calibrationRows: Array<Record<string, unknown>>
  maintenancePlanRows: Array<Record<string, unknown>>
  workOrderRows: Array<Record<string, unknown>>
  downtimeRows: Array<Record<string, unknown>>
  asOfDate: string
}): LiveDashboardSummary {
  const equipment = input.equipmentRows.filter((row) => text(row.equipmentId))
  const calibration = input.calibrationRows.filter((row) => text(row.calibrationEquipmentId))
  const plans = input.maintenancePlanRows.filter((row) => text(row.planId))
  const workOrders = input.workOrderRows.filter((row) => text(row.workOrderId))
  const downtime = input.downtimeRows.filter((row) => text(row.downtimeId))

  const openStatuses = new Set(['OPEN', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'])

  return {
    equipmentTotal: equipment.length,
    productionCount: equipment.filter((row) => text(row.equipmentType) === 'PRODUCTION').length,
    measurementCount: equipment.filter((row) => text(row.equipmentType) === 'MEASUREMENT').length,
    runningCount: equipment.filter((row) => text(row.status) === 'RUNNING').length,
    downCount: equipment.filter((row) => text(row.status) === 'DOWN').length,
    calibrationTotal: calibration.length,
    calibrationOverdue: calibration.filter((row) => getCalibrationDueStatus(text(row.nextDueDate), input.asOfDate) === 'OVERDUE').length,
    workOrderOpen: workOrders.filter((row) => openStatuses.has(text(row.status))).length,
    criticalOpen: workOrders.filter((row) => openStatuses.has(text(row.status)) && text(row.priority) === 'CRITICAL').length,
    pmOverdue: plans.filter((row) => text(row.status) === 'OVERDUE').length,
    downtimeOpen: downtime.filter((row) => !text(row.restoredAt)).length,
    downtimeMinutes: downtime.reduce((sum, row) => sum + numberValue(row.downtimeMinutes), 0),
  }
}

export async function loadLiveDashboard(
  client: Pick<AppsScriptBridgeClient, 'readTable'>,
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  const [equipmentRows, calibrationRows, maintenancePlanRows, workOrderRows, downtimeRows] = await Promise.all([
    client.readTable<Record<string, unknown>>('Equipment_Master'),
    client.readTable<Record<string, unknown>>('Calibration_Master'),
    client.readTable<Record<string, unknown>>('Maintenance_Plan'),
    client.readTable<Record<string, unknown>>('Maintenance_Work_Order'),
    client.readTable<Record<string, unknown>>('Downtime_Event'),
  ])

  return summarizeLiveDashboard({
    equipmentRows,
    calibrationRows,
    maintenancePlanRows,
    workOrderRows,
    downtimeRows,
    asOfDate,
  })
}
