import { describe, expect, it } from 'vitest'
import { getInspectionEscalation, transitionMaintenanceStatus } from './workflow'

describe('source-driven workflow rules', () => {
  it('turns BM-KTTBHN X into stop + work order + downtime', () => {
    expect(getInspectionEscalation('STOP_REPAIR')).toEqual({
      createWorkOrder: true,
      createDowntime: true,
      stopEquipment: true,
      priority: 'CRITICAL',
    })
  })

  it('does not create maintenance work for a good daily check', () => {
    expect(getInspectionEscalation('V').createWorkOrder).toBe(false)
  })

  it('enforces repair -> verify -> release sequence', () => {
    expect(transitionMaintenanceStatus('OPEN', 'START')).toBe('IN_PROGRESS')
    expect(transitionMaintenanceStatus('IN_PROGRESS', 'COMPLETE')).toBe('COMPLETED')
    expect(transitionMaintenanceStatus('COMPLETED', 'VERIFY')).toBe('VERIFIED')
    expect(transitionMaintenanceStatus('VERIFIED', 'RELEASE')).toBe('RELEASED')
    expect(() => transitionMaintenanceStatus('OPEN', 'RELEASE')).toThrow()
  })
})
