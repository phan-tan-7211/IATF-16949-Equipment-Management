import type { AppsScriptBridgeClient } from './appsScriptBridgeClient'

export type LiveTooling = {
  toolingId: string
  toolingName: string
  toolingType: string
  ownership: string
  managingDepartment: string
  storageLocation: string
  status: string
  inspectionCycleDays: string
}

export type LiveToolingPlan = {
  toolingPlanId: string
  toolingId: string
  inspectionItem: string
  acceptanceCriteria: string
  frequencyType: string
  frequencyValue: string
  responsiblePerson: string
  lastResultDate: string
}

export type LiveToolingModification = {
  modificationId: string
  toolingId: string
  modificationDate: string
  modificationType: string
  reason: string
  proposedBy: string
  approvedBy: string
  qaConfirmedBy: string
  updatedDocuments: string
  status: string
}

type ActionResponse = { ok: true; duplicate: boolean; operationId: string; result: Record<string, unknown> }

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export function normalizeToolingRows(rows: Array<Record<string, unknown>>): LiveTooling[] {
  return rows.map((row) => ({
    toolingId: text(row.toolingId), toolingName: text(row.toolingName), toolingType: text(row.toolingType), ownership: text(row.ownership),
    managingDepartment: text(row.managingDepartment), storageLocation: text(row.storageLocation), status: text(row.status), inspectionCycleDays: text(row.inspectionCycleDays),
  })).filter((row) => row.toolingId)
}

export async function loadLiveTooling(client: Pick<AppsScriptBridgeClient, 'readTable'>) {
  const [masterRows, planRows, modificationRows] = await Promise.all([
    client.readTable<Record<string, unknown>>('Tooling_Master'),
    client.readTable<Record<string, unknown>>('Tooling_Maintenance_Plan'),
    client.readTable<Record<string, unknown>>('Tooling_Modification'),
  ])
  return {
    tooling: normalizeToolingRows(masterRows),
    plans: planRows.map((row) => ({ toolingPlanId: text(row.toolingPlanId), toolingId: text(row.toolingId), inspectionItem: text(row.inspectionItem), acceptanceCriteria: text(row.acceptanceCriteria), frequencyType: text(row.frequencyType), frequencyValue: text(row.frequencyValue), responsiblePerson: text(row.responsiblePerson), lastResultDate: text(row.lastResultDate) })).filter((row) => row.toolingPlanId),
    modifications: modificationRows.map((row) => ({ modificationId: text(row.modificationId), toolingId: text(row.toolingId), modificationDate: text(row.modificationDate), modificationType: text(row.modificationType), reason: text(row.reason), proposedBy: text(row.proposedBy), approvedBy: text(row.approvedBy), qaConfirmedBy: text(row.qaConfirmedBy), updatedDocuments: text(row.updatedDocuments), status: text(row.status) })).filter((row) => row.modificationId),
  }
}

export function createTooling(client: Pick<AppsScriptBridgeClient, 'businessAction'>, input: Record<string, unknown>) {
  return client.businessAction<ActionResponse>('toolingCreate', { operationId: `tooling-create-${crypto.randomUUID()}`, input })
}

export function createToolingPlan(client: Pick<AppsScriptBridgeClient, 'businessAction'>, input: Record<string, unknown>) {
  return client.businessAction<ActionResponse>('toolingPlanCreate', { operationId: `tooling-plan-${crypto.randomUUID()}`, input })
}

export function createToolingModification(client: Pick<AppsScriptBridgeClient, 'businessAction'>, input: Record<string, unknown>) {
  return client.businessAction<ActionResponse>('toolingModificationCreate', { operationId: `tooling-mod-${crypto.randomUUID()}`, input })
}

export function transitionToolingModification(client: Pick<AppsScriptBridgeClient, 'businessAction'>, modificationId: string, action: 'APPROVE' | 'QA_CONFIRM' | 'COMPLETE', updatedDocuments = '') {
  const actionMap = { APPROVE: 'toolingModificationApprove', QA_CONFIRM: 'toolingModificationConfirmQuality', COMPLETE: 'toolingModificationComplete' } as const
  return client.businessAction<ActionResponse>(actionMap[action], { operationId: `tooling-${action.toLowerCase()}-${crypto.randomUUID()}`, modificationId, updatedDocuments })
}
