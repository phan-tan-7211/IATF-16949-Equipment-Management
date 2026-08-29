import type { AppsScriptBridgeClient } from './appsScriptBridgeClient'

export type LiveSession = { email: string; role: string; contractVersion: string }
export type LiveAudit = { auditId: string; timestamp: string; userId: string; action: string; entityType: string; entityId: string; oldValueJson: string; newValueJson: string }

type SessionResponse = { ok: true; email: string; role: string; contractVersion: string }
type AuditResponse = { ok: true; rows: Array<Record<string, unknown>> }

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export async function loadLiveSession(client: Pick<AppsScriptBridgeClient, 'businessAction'>): Promise<LiveSession> {
  const response = await client.businessAction<SessionResponse>('sessionInfo', {})
  if (!response?.ok || !response.email || !response.role) throw new Error('SESSION_RESPONSE_INVALID')
  return { email: response.email, role: response.role, contractVersion: response.contractVersion }
}

export async function loadLiveAudit(client: Pick<AppsScriptBridgeClient, 'businessAction'>): Promise<LiveAudit[]> {
  const response = await client.businessAction<AuditResponse>('auditRead', {})
  if (!response?.ok || !Array.isArray(response.rows)) throw new Error('AUDIT_RESPONSE_INVALID')
  return response.rows.map((row) => ({
    auditId: text(row.auditId), timestamp: text(row.timestamp), userId: text(row.userId), action: text(row.action), entityType: text(row.entityType), entityId: text(row.entityId), oldValueJson: text(row.oldValueJson), newValueJson: text(row.newValueJson),
  })).filter((row) => row.auditId)
}
