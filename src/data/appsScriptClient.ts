import { GOOGLE_PERSISTENCE_CONFIG } from '../domain/persistenceConfig'
import type { PERSISTENCE_TABLES } from '../domain/persistenceContract'

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

export class AppsScriptPersistenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppsScriptPersistenceError'
  }
}

function resolveWebAppUrl(explicitUrl?: string) {
  const url = String(explicitUrl ?? import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL ?? '').trim()
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

  return {
    async health(): Promise<AppsScriptHealthResponse> {
      const url = new URL(getUrl())
      url.searchParams.set('action', 'health')
      return parseResponse<AppsScriptHealthResponse>(await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
      }))
    },

    async readTable<T extends Record<string, unknown>>(table: PersistenceTable): Promise<T[]> {
      if (!GOOGLE_PERSISTENCE_CONFIG.tables.includes(table)) {
        throw new AppsScriptPersistenceError('TABLE_NOT_ALLOWED')
      }

      const url = new URL(getUrl())
      url.searchParams.set('action', 'readTable')
      url.searchParams.set('table', table)
      const response = await parseResponse<AppsScriptReadResponse<T>>(await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
      }))
      return response.rows
    },

    async appendRecord(input: AppendRecordInput): Promise<AppendRecordResponse> {
      if (input.table === 'Audit_Log' || !GOOGLE_PERSISTENCE_CONFIG.tables.includes(input.table)) {
        throw new AppsScriptPersistenceError('TABLE_NOT_ALLOWED')
      }
      if (!input.operationId.trim()) throw new AppsScriptPersistenceError('OPERATION_ID_REQUIRED')

      return parseResponse<AppendRecordResponse>(await fetchImpl(getUrl(), {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
        },
        body: JSON.stringify({
          action: 'appendRecord',
          contractVersion: GOOGLE_PERSISTENCE_CONFIG.contractVersion,
          table: input.table,
          operationId: input.operationId,
          entityType: input.entityType,
          entityId: input.entityId,
          record: input.record,
        }),
      }))
    },
  }
}

export type AppsScriptClient = ReturnType<typeof createAppsScriptClient>
