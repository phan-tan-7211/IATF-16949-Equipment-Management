import { GOOGLE_PERSISTENCE_CONFIG } from '../domain/persistenceConfig'
import { PERSISTENCE_TABLES } from '../domain/persistenceContract'
import type { MaintenanceWorkflowAction } from '../domain/workflow'

const CHANNEL = 'CEV_APPS_SCRIPT_BRIDGE'
const DEFAULT_TIMEOUT_MS = 15000
const APPS_SCRIPT_CONTENT_ORIGIN = 'https://script.googleusercontent.com'

type PersistenceTable = (typeof PERSISTENCE_TABLES)[number]

type BridgeReadyMessage = { channel: typeof CHANNEL; type: 'ready'; contractVersion: string }
type BridgeResponseMessage = { channel: typeof CHANNEL; type: 'response'; requestId: string; ok: boolean; result?: unknown; error?: string }
type ReadTableResponse<T> = { ok: true; table: PersistenceTable; rows: T[]; actor: string }

export type DailyInspectionMark = 'V' | 'URGENT_REPAIR' | 'MAINTENANCE_REQUIRED' | 'STOP_REPAIR'
export type DailyInspectionShift = '' | 'MORNING' | 'AFTERNOON' | 'NIGHT'
export type WorkOrderPriority = '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type DailyInspectionSubmitInput = { operationId: string; input: { equipmentId: string; shift: DailyInspectionShift; area: string; overallMark: DailyInspectionMark; note: string; damagedParts: string; priority: WorkOrderPriority } }
type DailyInspectionSubmitResponse = { ok: true; duplicate: boolean; operationId: string; result: { inspectionId: string; overallMark: DailyInspectionMark; workOrderId: string | null; downtimeId: string | null; auditId: string } }

export type CreateMaintenanceWorkOrderInput = { operationId: string; input: { equipmentId: string; sourceType: 'PLAN' | 'DAILY_INSPECTION' | 'DOWNTIME' | 'PREDICTIVE' | 'MANUAL'; sourceId: string; reason: string; priority: Exclude<WorkOrderPriority, ''>; method: string; plannedStartAt: string; plannedEndAt: string } }
type CreateMaintenanceWorkOrderResponse = { ok: true; duplicate: boolean; operationId: string; result: { workOrderId: string; status: string; rowNumber: number; auditId: string } }
type MaintenanceTransitionResponse = { ok: true; duplicate: boolean; operationId: string; result: { workOrderId: string; previousStatus: string; status: string; executionId: string | null; auditId: string } }

export class AppsScriptBridgeError extends Error {
  constructor(message: string) { super(message); this.name = 'AppsScriptBridgeError' }
}

function resolveWebAppUrl(explicitUrl?: string) {
  const configured = explicitUrl ?? import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL ?? GOOGLE_PERSISTENCE_CONFIG.defaultWebAppUrl
  const value = String(configured || '').trim()
  if (!value) throw new AppsScriptBridgeError('APPS_SCRIPT_WEB_APP_URL_NOT_CONFIGURED')
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new AppsScriptBridgeError('APPS_SCRIPT_WEB_APP_URL_INVALID') }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' || !parsed.pathname.endsWith('/exec')) throw new AppsScriptBridgeError('APPS_SCRIPT_WEB_APP_URL_NOT_ALLOWED')
  parsed.searchParams.set('action', 'bridge')
  return parsed
}

function isAllowedBridgeOrigin(origin: string, launchOrigin: string) {
  return origin === launchOrigin || origin === APPS_SCRIPT_CONTENT_ORIGIN
}

function assertTable(table: string): asserts table is PersistenceTable {
  if (!(PERSISTENCE_TABLES as readonly string[]).includes(table)) throw new AppsScriptBridgeError('TABLE_NOT_ALLOWED')
}

export function createAppsScriptBridgeClient(options?: { webAppUrl?: string; timeoutMs?: number; windowRef?: Window; documentRef?: Document }) {
  const windowRef = options?.windowRef ?? window
  const documentRef = options?.documentRef ?? document
  const bridgeUrl = resolveWebAppUrl(options?.webAppUrl)
  const bridgeLaunchOrigin = bridgeUrl.origin
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let iframe: HTMLIFrameElement | null = null
  let readyPromise: Promise<void> | null = null
  let bridgeContentOrigin: string | null = null
  let sequence = 0
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void; timer: number }>()

  const onMessage = (event: MessageEvent) => {
    if (!isAllowedBridgeOrigin(event.origin, bridgeLaunchOrigin)) return
    if (bridgeContentOrigin && event.origin !== bridgeContentOrigin) return
    if (iframe?.contentWindow && event.source !== iframe.contentWindow) return
    const message = event.data as BridgeReadyMessage | BridgeResponseMessage | undefined
    if (!message || message.channel !== CHANNEL) return
    if (message.type === 'response') {
      const item = pending.get(message.requestId)
      if (!item) return
      windowRef.clearTimeout(item.timer)
      pending.delete(message.requestId)
      if (message.ok) item.resolve(message.result)
      else item.reject(new AppsScriptBridgeError(message.error || 'BRIDGE_REQUEST_FAILED'))
    }
  }
  windowRef.addEventListener('message', onMessage)

  const ensureReady = () => {
    if (readyPromise) return readyPromise
    readyPromise = new Promise<void>((resolve, reject) => {
      iframe = documentRef.createElement('iframe')
      iframe.src = bridgeUrl.toString()
      iframe.title = 'CEV backend bridge'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.tabIndex = -1
      iframe.style.display = 'none'
      const timer = windowRef.setTimeout(() => reject(new AppsScriptBridgeError('BRIDGE_READY_TIMEOUT')), timeoutMs)
      const readyHandler = (event: MessageEvent) => {
        if (!isAllowedBridgeOrigin(event.origin, bridgeLaunchOrigin) || event.source !== iframe?.contentWindow) return
        const message = event.data as BridgeReadyMessage | undefined
        if (!message || message.channel !== CHANNEL || message.type !== 'ready') return
        if (message.contractVersion !== GOOGLE_PERSISTENCE_CONFIG.contractVersion) {
          windowRef.clearTimeout(timer); windowRef.removeEventListener('message', readyHandler); reject(new AppsScriptBridgeError('CONTRACT_VERSION_MISMATCH')); return
        }
        bridgeContentOrigin = event.origin
        windowRef.clearTimeout(timer); windowRef.removeEventListener('message', readyHandler); resolve()
      }
      windowRef.addEventListener('message', readyHandler)
      documentRef.body.appendChild(iframe)
    })
    return readyPromise
  }

  const invoke = async <T>(payload: Record<string, unknown>): Promise<T> => {
    await ensureReady()
    if (!iframe?.contentWindow) throw new AppsScriptBridgeError('BRIDGE_WINDOW_UNAVAILABLE')
    if (!bridgeContentOrigin) throw new AppsScriptBridgeError('BRIDGE_ORIGIN_UNAVAILABLE')
    sequence += 1
    const requestId = `vercel-${Date.now()}-${sequence}`
    return new Promise<T>((resolve, reject) => {
      const timer = windowRef.setTimeout(() => { pending.delete(requestId); reject(new AppsScriptBridgeError('BRIDGE_REQUEST_TIMEOUT')) }, timeoutMs)
      pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timer })
      iframe?.contentWindow?.postMessage({ channel: CHANNEL, type: 'request', requestId, payload }, bridgeContentOrigin)
    })
  }

  return {
    async readTable<T extends Record<string, unknown>>(table: PersistenceTable): Promise<T[]> {
      assertTable(table)
      const response = await invoke<ReadTableResponse<T>>({ action: 'readTable', table })
      if (!response || response.ok !== true || response.table !== table || !Array.isArray(response.rows)) throw new AppsScriptBridgeError('READ_TABLE_RESPONSE_INVALID')
      return response.rows
    },
    async businessAction<T>(action: string, payload: Record<string, unknown>): Promise<T> {
      if (!action.trim()) throw new AppsScriptBridgeError('ACTION_REQUIRED')
      return invoke<T>({ action, ...payload })
    },
    async submitDailyInspection(request: DailyInspectionSubmitInput): Promise<DailyInspectionSubmitResponse> {
      if (!request.operationId.trim()) throw new AppsScriptBridgeError('OPERATION_ID_REQUIRED')
      if (!request.input.equipmentId.trim()) throw new AppsScriptBridgeError('EQUIPMENT_ID_REQUIRED')
      const response = await invoke<DailyInspectionSubmitResponse>({ action: 'dailyInspectionSubmit', operationId: request.operationId, input: request.input })
      if (!response || response.ok !== true || !response.result?.inspectionId) throw new AppsScriptBridgeError('DAILY_INSPECTION_RESPONSE_INVALID')
      return response
    },
    async createMaintenanceWorkOrder(request: CreateMaintenanceWorkOrderInput): Promise<CreateMaintenanceWorkOrderResponse> {
      if (!request.operationId.trim()) throw new AppsScriptBridgeError('OPERATION_ID_REQUIRED')
      if (!request.input.equipmentId.trim()) throw new AppsScriptBridgeError('EQUIPMENT_ID_REQUIRED')
      if (!request.input.reason.trim()) throw new AppsScriptBridgeError('WORK_ORDER_REASON_REQUIRED')
      const response = await invoke<CreateMaintenanceWorkOrderResponse>({ action: 'createMaintenanceWorkOrder', operationId: request.operationId, input: request.input })
      if (!response || response.ok !== true || !response.result?.workOrderId) throw new AppsScriptBridgeError('CREATE_WORK_ORDER_RESPONSE_INVALID')
      return response
    },
    async transitionMaintenance(request: { workOrderId: string; workflowAction: MaintenanceWorkflowAction; operationId: string }): Promise<MaintenanceTransitionResponse> {
      if (!request.workOrderId.trim()) throw new AppsScriptBridgeError('WORK_ORDER_ID_REQUIRED')
      if (!request.operationId.trim()) throw new AppsScriptBridgeError('OPERATION_ID_REQUIRED')
      const response = await invoke<MaintenanceTransitionResponse>({ action: 'maintenanceTransition', workOrderId: request.workOrderId, workflowAction: request.workflowAction, operationId: request.operationId })
      if (!response || response.ok !== true || !response.result?.workOrderId) throw new AppsScriptBridgeError('MAINTENANCE_TRANSITION_RESPONSE_INVALID')
      return response
    },
    destroy() {
      pending.forEach((item) => { windowRef.clearTimeout(item.timer); item.reject(new AppsScriptBridgeError('BRIDGE_DESTROYED')) })
      pending.clear(); windowRef.removeEventListener('message', onMessage); iframe?.remove(); iframe = null; readyPromise = null; bridgeContentOrigin = null
    },
  }
}

export type AppsScriptBridgeClient = ReturnType<typeof createAppsScriptBridgeClient>
