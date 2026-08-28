import { GOOGLE_PERSISTENCE_CONFIG } from '../domain/persistenceConfig'
import { PERSISTENCE_TABLES } from '../domain/persistenceContract'
import type { MaintenanceWorkflowAction } from '../domain/workflow'

type PersistenceTable = (typeof PERSISTENCE_TABLES)[number]

type AppsScriptErrorResponse = {
  ok: false
  error: string
}

type AppsScriptHealthResponse = {
  ok: true
  provider: 'GOOGLE_APPS_SCRIPT'
  boundary: 'APPS_SCRIPT_WEB_APP'
  contractVersion: string
  authenticated: boolean
}

type AppsScriptReadResponse<T> = {
  ok: true
  table: PersistenceTable
  rows: T[]
  actor: string
}

type AppendRecordInput = {
  table: Exclude<PersistenceTable, 'Audit_Log'>
  operationId: string
  entityType: string
  entityId: string
  record: Record<string, unknown>
}

type AppendRecordResponse = {
  ok: true
  duplicate: boolean
  operationId: string
  result: {
    table: string
    rowNumber: number
    auditId: string
  }
}

type MaintenanceTransitionInput = {
  workOrderId: string
  workflowAction: MaintenanceWorkflowAction
  operationId: string
}

type MaintenanceTransitionResponse = {
  ok: true
  duplicate: boolean
  operationId: string
  result: {
    workOrderId: string
    previousStatus: string
    status: string
    executionId: string | null
    auditId: string
  }
}

const ALLOWED_TABLES = new Set<string>(GOOGLE_PERSISTENCE_CONFIG.tables)

export class AppsScriptPersistenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppsScriptPersistenceError'
  }
}

function resolveWebAppUrl(explicitUrl?: string) {
  const configured = explicitUrl !== undefined
    ? explicitUrl
    : (import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL || GOOGLE_PERSISTENCE_CONFIG.deploymentUrl)
  const url = String(configured ?? '').trim()
  if (!url) throw new AppsScriptPersistenceError('APPS_SCRIPT_WEB_APP_URL_NOT_CONFIGURED')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppsScriptPersistenceError('APPS_SCRIPT_WEB_APP_URL_INVALID')
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' || !parsed.pathname.endsWith('/exec')) {
    throw new AppsScriptPersistenceError('APPS_SCRIPT_WEB_APP_URL_NOT_ALLOWED')
  }

  return parsed.toString()
}

function assertAllowedTable(table: string) {
  if (!ALLOWED_TABLES.has(table)) throw new AppsScriptPersistenceError('TABLE_NOT_ALLOWED')
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new AppsScriptPersistenceError(`HTTP_${response.status}`)

  const payload = await response.json() as T | AppsScriptErrorResponse
  if (!payload || typeof payload !== 'object' || !('ok' in payload)) {
    throw new AppsScriptPersistenceError('APPS_SCRIPT_RESPONSE_INVALID')
  }
  if (payload.ok === false) throw new AppsScriptPersistenceError(payload.error || 'APPS_SCRIPT_REQUEST_FAILED')

  return payload as T
}

export function createAppsScriptClient(options?: { webAppUrl?: string; fetchImpl?: typeof fetch }) {
  const fetchImpl = options?.fetchImpl ?? fetch
  const getUrl = () => resolveWebAppUrl(options?.webAppUrl)
  const authenticatedRequest: Pick<RequestInit, 'credentials' | 'redirect'> = {
    credentials: 'include',
    redirect: 'follow',
  }

  const postJson = async <T>(payload: Record<string, unknown>): Promise<T> => parseResponse<T>(await fetchImpl(getUrl(), {
    ...authenticatedRequest,
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    body: JSON.stringify({
      ...payload,
      contractVersion: GOOGLE_PERSISTENCE_CONFIG.contractVersion,
    }),
  }))

  return {
    async health(): Promise<AppsScriptHealthResponse> {
      const url = new URL(getUrl())
      url.searchParams.set('action', 'health')
      return parseResponse<AppsScriptHealthResponse>(await fetchImpl(url, {
        ...authenticatedRequest,
        method: 'GET',
      }))
    },

    async readTable<T extends Record<string, unknown>>(table: PersistenceTable): Promise<T[]> {
      assertAllowedTable(table)

      const url = new URL(getUrl())
      url.searchParams.set('action', 'readTable')
      url.searchParams.set('table', table)
      const response = await parseResponse<AppsScriptReadResponse<T>>(await fetchImpl(url, {
        ...authenticatedRequest,
        method: 'GET',
      }))
      return response.rows
    },

    async appendRecord(input: AppendRecordInput): Promise<AppendRecordResponse> {
      assertAllowedTable(input.table)
      if (!input.operationId.trim()) throw new AppsScriptPersistenceError('OPERATION_ID_REQUIRED')

      return postJson<AppendRecordResponse>({
        action: 'appendRecord',
        table: input.table,
        operationId: input.operationId,
        entityType: input.entityType,
        entityId: input.entityId,
        record: input.record,
      })
    },

    async transitionMaintenance(input: MaintenanceTransitionInput): Promise<MaintenanceTransitionResponse> {
      if (!input.workOrderId.trim()) throw new AppsScriptPersistenceError('WORK_ORDER_ID_REQUIRED')
      if (!input.operationId.trim()) throw new AppsScriptPersistenceError('OPERATION_ID_REQUIRED')

      return postJson<MaintenanceTransitionResponse>({
        action: 'maintenanceTransition',
        workOrderId: input.workOrderId,
        workflowAction: input.workflowAction,
        operationId: input.operationId,
      })
    },
  }
}

export type AppsScriptClient = ReturnType<typeof createAppsScriptClient>
