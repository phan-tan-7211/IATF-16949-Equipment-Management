import { describe, expect, it } from 'vitest'
import { createManualWorkOrder, loadLiveMaintenance, normalizeMaintenanceWorkOrders, transitionLiveMaintenance } from './liveMaintenance'

describe('live maintenance', () => {
  it('normalizes work orders newest first', () => {
    const rows = normalizeMaintenanceWorkOrders([
      { workOrderId: 'WO-1', equipmentId: 'P1', requestedAt: '2026-08-28T01:00:00Z', status: 'OPEN' },
      { workOrderId: 'WO-2', equipmentId: 'P1', requestedAt: '2026-08-29T01:00:00Z', status: 'WAITING_APPROVAL' },
    ])
    expect(rows.map((row) => row.workOrderId)).toEqual(['WO-2', 'WO-1'])
  })

  it('loads only active production equipment plus maintenance tables', async () => {
    const client = {
      readTable: async (table: string) => {
        if (table === 'Equipment_Master') return [
          { equipmentId: 'P1', equipmentName: 'Press', equipmentType: 'PRODUCTION', status: 'RUNNING' },
          { equipmentId: 'M1', equipmentName: 'Caliper', equipmentType: 'MEASUREMENT', status: 'RUNNING' },
        ]
        if (table === 'Maintenance_Work_Order') return [{ workOrderId: 'WO-1', equipmentId: 'P1', status: 'OPEN' }]
        return []
      },
    }
    const result = await loadLiveMaintenance(client as never)
    expect(result.equipment.map((item) => item.equipmentId)).toEqual(['P1'])
    expect(result.workOrders).toHaveLength(1)
  })

  it('uses backend business actions for create and transition', async () => {
    let created: unknown = null
    let transitioned: unknown = null
    const client = {
      createMaintenanceWorkOrder: async (request: unknown) => { created = request; return { ok: true } },
      transitionMaintenance: async (request: unknown) => { transitioned = request; return { ok: true } },
    }

    await createManualWorkOrder(client as never, {
      operationId: 'create-1',
      input: {
        equipmentId: 'P1', sourceType: 'MANUAL', sourceId: '', reason: 'Noise', priority: 'HIGH', method: '', plannedStartAt: '', plannedEndAt: '',
      },
    })
    await transitionLiveMaintenance(client as never, { workOrderId: 'WO-1', workflowAction: 'REQUEST_APPROVAL', operationId: 'transition-1' })

    expect(created).toMatchObject({ input: { equipmentId: 'P1', sourceType: 'MANUAL' } })
    expect(transitioned).toMatchObject({ workOrderId: 'WO-1', workflowAction: 'REQUEST_APPROVAL' })
  })
})
