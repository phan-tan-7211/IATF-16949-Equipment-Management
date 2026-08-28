import { describe, expect, it, vi } from 'vitest'
import { AppsScriptPersistenceError, createAppsScriptClient } from './appsScriptClient'

const WEB_APP_URL = 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec'

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Apps Script persistence client', () => {
  it('fails closed when an explicit deployment URL is empty', async () => {
    const client = createAppsScriptClient({ webAppUrl: '' })
    await expect(client.health()).rejects.toEqual(new AppsScriptPersistenceError('APPS_SCRIPT_WEB_APP_URL_NOT_CONFIGURED'))
  })

  it('rejects non Apps Script deployment URLs', async () => {
    const client = createAppsScriptClient({ webAppUrl: 'https://example.com/exec' })
    await expect(client.health()).rejects.toEqual(new AppsScriptPersistenceError('APPS_SCRIPT_WEB_APP_URL_NOT_ALLOWED'))
  })

  it('reads an allowlisted G1 table with the browser Google session included', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.searchParams.get('action')).toBe('readTable')
      expect(url.searchParams.get('table')).toBe('Equipment_Master')
      expect(init?.credentials).toBe('include')
      expect(init?.redirect).toBe('follow')
      return jsonResponse({ ok: true, table: 'Equipment_Master', actor: 'user@example.com', rows: [{ equipmentId: 'CNC-001' }] })
    })

    const client = createAppsScriptClient({ webAppUrl: WEB_APP_URL, fetchImpl: fetchImpl as typeof fetch })
    await expect(client.readTable<{ equipmentId: string }>('Equipment_Master')).resolves.toEqual([{ equipmentId: 'CNC-001' }])
  })

  it('posts append JSON as text/plain and carries the frozen contract plus operation id', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(init?.credentials).toBe('include')
      expect(init?.headers).toEqual({ 'Content-Type': 'text/plain;charset=UTF-8' })
      const body = JSON.parse(String(init?.body))
      expect(body.contractVersion).toBe('G1-frozen-2026-08-28')
      expect(body.operationId).toBe('op-001')
      expect(body.table).toBe('Maintenance_Work_Order')
      return jsonResponse({
        ok: true,
        duplicate: false,
        operationId: 'op-001',
        result: { table: 'Maintenance_Work_Order', rowNumber: 2, auditId: 'audit-001' },
      })
    })

    const client = createAppsScriptClient({ webAppUrl: WEB_APP_URL, fetchImpl: fetchImpl as typeof fetch })
    const result = await client.appendRecord({
      table: 'Maintenance_Work_Order',
      operationId: 'op-001',
      entityType: 'MAINTENANCE',
      entityId: 'WO-001',
      record: { workOrderId: 'WO-001' },
    })

    expect(result.result.auditId).toBe('audit-001')
  })

  it('sends workflow transitions without trusting actor identity from the browser', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({
        action: 'maintenanceTransition',
        contractVersion: 'G1-frozen-2026-08-28',
        workOrderId: 'WO-001',
        workflowAction: 'VERIFY',
        operationId: 'transition-001',
      })
      expect(body.actor).toBeUndefined()
      expect(body.role).toBeUndefined()
      return jsonResponse({
        ok: true,
        duplicate: false,
        operationId: 'transition-001',
        result: {
          workOrderId: 'WO-001',
          previousStatus: 'COMPLETED',
          status: 'VERIFIED',
          executionId: 'EX-001',
          auditId: 'audit-verify',
        },
      })
    })

    const client = createAppsScriptClient({ webAppUrl: WEB_APP_URL, fetchImpl: fetchImpl as typeof fetch })
    const result = await client.transitionMaintenance({
      workOrderId: 'WO-001',
      workflowAction: 'VERIFY',
      operationId: 'transition-001',
    })

    expect(result.result.status).toBe('VERIFIED')
  })

  it('surfaces Apps Script domain errors without treating them as successful writes', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false, error: 'ROLE_NOT_ALLOWED' }))
    const client = createAppsScriptClient({ webAppUrl: WEB_APP_URL, fetchImpl: fetchImpl as typeof fetch })

    await expect(client.appendRecord({
      table: 'Maintenance_Work_Order',
      operationId: 'op-002',
      entityType: 'MAINTENANCE',
      entityId: 'WO-002',
      record: { workOrderId: 'WO-002' },
    })).rejects.toEqual(new AppsScriptPersistenceError('ROLE_NOT_ALLOWED'))
  })
})
