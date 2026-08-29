import type { AppsScriptBridgeClient, CreateMaintenanceWorkOrderInput } from './appsScriptBridgeClient'
import type { MaintenanceWorkflowAction, MaintenanceWorkflowStatus } from '../domain/workflow'

export type MaintenanceEquipmentOption = {
  equipmentId: string
  equipmentName: string
}

export type LiveMaintenanceWorkOrder = {
  workOrderId: string
  equipmentId: string
  sourceType: string
  requestedAt: string
  requestedBy: string
  reason: string
  priority: string
  status: MaintenanceWorkflowStatus
  approvedBy: string
  approvedAt: string
}

export type LiveMaintenancePlan = {
  planId: string
  equipmentId: string
  maintenanceType: string
  plannedDate: string
  responsiblePerson: string
  status: string
}

export type LiveHandover = {
  handoverId: string
  equipmentId: string
  accepted: boolean
  condition: string
  handoverAt: string
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function bool(value: unknown) {
  if (typeof value === 'boolean') return value
  return ['TRUE', '1', 'YES'].includes(text(value).toUpperCase())
}

export function normalizeMaintenanceWorkOrders(rows: Array<Record<string, unknown>>): LiveMaintenanceWorkOrder[] {
  return rows
    .filter((row) => text(row.workOrderId))
    .map((row) => ({
      workOrderId: text(row.workOrderId),
      equipmentId: text(row.equipmentId),
      sourceType: text(row.sourceType),
      requestedAt: text(row.requestedAt),
      requestedBy: text(row.requestedBy),
      reason: text(row.reason),
      priority: text(row.priority),
      status: text(row.status) as MaintenanceWorkflowStatus,
      approvedBy: text(row.approvedBy),
      approvedAt: text(row.approvedAt),
    }))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
}

export async function loadLiveMaintenance(client: Pick<AppsScriptBridgeClient, 'readTable'>) {
  const [equipmentRows, planRows, workOrderRows, handoverRows] = await Promise.all([
    client.readTable<Record<string, unknown>>('Equipment_Master'),
    client.readTable<Record<string, unknown>>('Maintenance_Plan'),
    client.readTable<Record<string, unknown>>('Maintenance_Work_Order'),
    client.readTable<Record<string, unknown>>('Equipment_Handover'),
  ])

  const equipment: MaintenanceEquipmentOption[] = equipmentRows
    .filter((row) => text(row.equipmentId) && text(row.equipmentType) === 'PRODUCTION' && text(row.status) !== 'DISPOSED')
    .map((row) => ({ equipmentId: text(row.equipmentId), equipmentName: text(row.equipmentName) }))
    .sort((a, b) => a.equipmentId.localeCompare(b.equipmentId))

  const plans: LiveMaintenancePlan[] = planRows
    .filter((row) => text(row.planId))
    .map((row) => ({
      planId: text(row.planId),
      equipmentId: text(row.equipmentId),
      maintenanceType: text(row.maintenanceType),
      plannedDate: text(row.plannedDate),
      responsiblePerson: text(row.responsiblePerson),
      status: text(row.status),
    }))

  const handovers: LiveHandover[] = handoverRows
    .filter((row) => text(row.handoverId))
    .map((row) => ({
      handoverId: text(row.handoverId),
      equipmentId: text(row.equipmentId),
      accepted: bool(row.accepted),
      condition: text(row.condition),
      handoverAt: text(row.handoverAt),
    }))

  return { equipment, plans, workOrders: normalizeMaintenanceWorkOrders(workOrderRows), handovers }
}

export function createManualWorkOrder(client: Pick<AppsScriptBridgeClient, 'createMaintenanceWorkOrder'>, request: CreateMaintenanceWorkOrderInput) {
  return client.createMaintenanceWorkOrder(request)
}

export function transitionLiveMaintenance(
  client: Pick<AppsScriptBridgeClient, 'transitionMaintenance'>,
  request: { workOrderId: string; workflowAction: MaintenanceWorkflowAction; operationId: string },
) {
  return client.transitionMaintenance(request)
}
