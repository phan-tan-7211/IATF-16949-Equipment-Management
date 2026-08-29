import { describe, expect, it } from 'vitest'
import { loadLiveInspection, normalizeInspectionEquipment, normalizeInspections, submitLiveInspection } from './liveInspection'

describe('live inspection', () => {
  it('uses only canonical production equipment for daily inspection', () => {
    const rows = normalizeInspectionEquipment([
      { equipmentId: 'CEV-P-001', equipmentName: 'Press', equipmentType: 'PRODUCTION', status: 'RUNNING' },
      { equipmentId: 'CEV-ME-001', equipmentName: 'Caliper', equipmentType: 'MEASUREMENT', status: 'RUNNING' },
      { equipmentId: 'CEV-P-002', equipmentName: 'Old', equipmentType: 'PRODUCTION', status: 'DISPOSED' },
    ])
    expect(rows.map((row) => row.equipmentId)).toEqual(['CEV-P-001'])
  })

  it('sorts inspection history newest first', () => {
    const rows = normalizeInspections([
      { inspectionId: 'DI-1', equipmentId: 'E1', inspectionDate: '2026-08-28', createdAt: '2026-08-28T01:00:00Z' },
      { inspectionId: 'DI-2', equipmentId: 'E1', inspectionDate: '2026-08-29', createdAt: '2026-08-29T01:00:00Z' },
    ])
    expect(rows.map((row) => row.inspectionId)).toEqual(['DI-2', 'DI-1'])
  })

  it('loads equipment and inspection tables through backend', async () => {
    const client = {
      readTable: async (table: string) => table === 'Equipment_Master'
        ? [{ equipmentId: 'P1', equipmentName: 'Press', equipmentType: 'PRODUCTION', status: 'RUNNING' }]
        : [{ inspectionId: 'DI-1', equipmentId: 'P1', overallMark: 'V' }],
    }
    const result = await loadLiveInspection(client as never)
    expect(result.equipment).toHaveLength(1)
    expect(result.inspections).toHaveLength(1)
  })

  it('submits through the dailyInspectionSubmit business action', async () => {
    let received: unknown = null
    const client = {
      submitDailyInspection: async (request: unknown) => {
        received = request
        return { ok: true, result: { inspectionId: 'DI-1' } }
      },
    }

    await submitLiveInspection(client as never, {
      operationId: 'op-1',
      equipmentId: 'P1',
      shift: 'MORNING',
      area: 'PRESS',
      overallMark: 'STOP_REPAIR',
      note: 'Motor abnormal',
      damagedParts: 'Motor',
      priority: 'CRITICAL',
    })

    expect(received).toMatchObject({
      operationId: 'op-1',
      input: { equipmentId: 'P1', overallMark: 'STOP_REPAIR', priority: 'CRITICAL' },
    })
  })
})
