import { GOOGLE_PERSISTENCE_CONFIG } from '../domain/persistenceConfig'
import { PERSISTENCE_TABLES } from '../domain/persistenceContract'

const CHANNEL = 'CEV_APPS_SCRIPT_BRIDGE'
const DEFAULT_TIMEOUT_MS = 15000

type PersistenceTable = (typeof PERSISTENCE_TABLES)[number]

type BridgeReadyMessage = {
  channel: typeof CHANNEL
  type: 'ready'
  contractVersion: string
}

type BridgeResponseMessage = {
  channel: typeof CHANNEL
  type: 'response'
  requestId: string
  ok: boolean
  result?: unknown
  error?: string
}

type ReadTableResponse<T> = {
  ok: true
  table: PersistenceTable
  rows: T[]
  actor: string
}

export class AppsScriptBridgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppsScriptBridgeError'
  }
}

function resolveWebAppUrl(explicitUrl?: string) {
  const configured = explicitUrl ?? import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL ?? GOOGLE_PERSISTENCE_CONFIG.defaultWebAppUrl
  const value = String(configured || '').trim()
  if (!value) throw new AppsScriptBridgeError('APPS_SCRIPT_WEB_APP_URL_NOT_CONFIGURED')

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new AppsScriptBridgeError('APPS_SCRIPT_WEB_APP_URL_INVALID')
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' || !parsed.pathname.endsWith('/exec')) {
    throw new AppsScriptBridgeError('APPS_SCRIPT_WEB_APP_URL_NOT_ALLOWED')
  }

  parsed.searchParams.set('action', 'bridge')
  return parsed
}

function assertTable(table: string): asserts table is PersistenceTable {
  if (!(PERSISTENCE_TABLES as readonly string[]).includes(table)) {
    throw new AppsScriptBridgeError('TABLE_NOT_ALLOWED')
  }
}

export function createAppsScriptBridgeClient(options?: {
  webAppUrl?: string
  timeoutMs?: number
  windowRef?: Window
  documentRef?: Document
}) {
  const windowRef = options?.windowRef ?? window
  const documentRef = options?.documentRef ?? document
  const bridgeUrl = resolveWebAppUrl(options?.webAppUrl)
  const bridgeOrigin = bridgeUrl.origin
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let iframe: HTMLIFrameElement | null = null
  let readyPromise: Promise<void> | null = null
  let sequence = 0
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void; timer: number }>()

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== bridgeOrigin) return
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
        if (event.origin !== bridgeOrigin || event.source !== iframe?.contentWindow) return
        const message = event.data as BridgeReadyMessage | undefined
        if (!message || message.channel !== CHANNEL || message.type !== 'ready') return
        if (message.contractVersion !== GOOGLE_PERSISTENCE_CONFIG.contractVersion) {
          windowRef.clearTimeout(timer)
          windowRef.removeEventListener('message', readyHandler)
          reject(new AppsScriptBridgeError('CONTRACT_VERSION_MISMATCH'))
          return
        }
        windowRef.clearTimeout(timer)
        windowRef.removeEventListener('message', readyHandler)
        resolve()
      }

      windowRef.addEventListener('message', readyHandler)
      documentRef.body.appendChild(iframe)
    })

    return readyPromise
  }

  const invoke = async <T>(payload: Record<string, unknown>): Promise<T> => {
    await ensureReady()
    if (!iframe?.contentWindow) throw new AppsScriptBridgeError('BRIDGE_WINDOW_UNAVAILABLE')

    sequence += 1
    const requestId = `vercel-${Date.now()}-${sequence}`

    return new Promise<T>((resolve, reject) => {
      const timer = windowRef.setTimeout(() => {
        pending.delete(requestId)
        reject(new AppsScriptBridgeError('BRIDGE_REQUEST_TIMEOUT'))
      }, timeoutMs)

      pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timer })
      iframe?.contentWindow?.postMessage({
        channel: CHANNEL,
        type: 'request',
        requestId,
        payload,
      }, bridgeOrigin)
    })
  }

  return {
    async readTable<T extends Record<string, unknown>>(table: PersistenceTable): Promise<T[]> {
      assertTable(table)
      const response = await invoke<ReadTableResponse<T>>({ action: 'readTable', table })
      if (!response || response.ok !== true || response.table !== table || !Array.isArray(response.rows)) {
        throw new AppsScriptBridgeError('READ_TABLE_RESPONSE_INVALID')
      }
      return response.rows
    },

    destroy() {
      pending.forEach((item) => {
        windowRef.clearTimeout(item.timer)
        item.reject(new AppsScriptBridgeError('BRIDGE_DESTROYED'))
      })
      pending.clear()
      windowRef.removeEventListener('message', onMessage)
      iframe?.remove()
      iframe = null
      readyPromise = null
    },
  }
}

export type AppsScriptBridgeClient = ReturnType<typeof createAppsScriptBridgeClient>
