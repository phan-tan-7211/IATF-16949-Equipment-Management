import { describe, expect, it } from 'vitest'
import { loadLiveDashboard, summarizeLiveDashboard } from './liveDashboard'

describe('live dashboard', () => {
  it('summarizes canonical production tables', () => {
    const summary = summarizeLiveDashboard({
      equipmentRows: [
        { equipmentId: 'P1', equipmentType: 'PRODUCTION', status: 'RUNNING' },
        { equipmentId: 'M1', equipmentType: 'MEASUREMENT', status: 'RUNNING' },
        { equipmentId: 'M2', equipmentType: 'MEASUREMENT', status: 'DOWN' },
      ],
      calibrationRows: [
        { calibrationEquipmentId: 'C1', nextDueDate: '2027-07-01' },
        { calibrationEquipmentId: 'C2', nextDueDate: '2026-07-01' },
      ],
      maintenancePlanRows: [
        { planId: 'PM1', status: 'OVERDUE' },
        { planId: 'PM2', status: 'PLANNED' },
      ],
      workOrderRows: [
        { workOrderId: 'WO1', status: 'OPEN', priority: 'CRITICAL' },
        { workOrderId: 'WO2', status: 'RELEASED', priority: 'CRITICAL' },
      ],
      downtimeRows: [
        { downtimeId: 'D1', restoredAt: '', downtimeMinutes: 30 },
        { downtimeId: 'D2', restoredAt: '2026-08-29T01:00:00Z', downtimeMinutes: '15' },
      ],
      asOfDate: '2026-08-29',
    })

    expect(summary).toEqual({
      equipmentTotal: 3,
      productionCount: 1,
      measurementCount: 2,
      runningCount: 2,
      downCount: 1,
      calibrationTotal: 2,
      calibrationOverdue: 1,
      workOrderOpen: 1,
      criticalOpen: 1,
      pmOverdue: 1,
      downtimeOpen: 1,
      downtimeMinutes: 45,
    })
  })

  it('loads all dashboard tables through backend client', async () => {
    const client = {
      readTable: async (table: string) => {
        if (table === 'Equipment_Master') return [{ equipmentId: 'CEV-ME-001', equipmentType: 'MEASUREMENT', status: 'RUNNING' }]
        if (table === 'Calibration_Master') return [{ calibrationEquipmentId: 'CAL-2026-001', nextDueDate: '2027-07-01' }]
        return []
      },
    }

    const summary = await loadLiveDashboard(client as never, '2026-08-29')
    expect(summary.equipmentTotal).toBe(1)
    expect(summary.measurementCount).toBe(1)
    expect(summary.calibrationTotal).toBe(1)
    expect(summary.calibrationOverdue).toBe(0)
  })
})
