import { describe, expect, it } from 'vitest'
import { loadLiveCalibration, normalizeCalibrationRows, resolveCalibrationLinkState } from './liveCalibration'

describe('live calibration', () => {
  it('classifies canonical measurement links without fuzzy matching', () => {
    const equipmentMap = new Map([
      ['CEV-ME-001', { equipmentId: 'CEV-ME-001', equipmentType: 'MEASUREMENT' }],
      ['CEV-PR-001', { equipmentId: 'CEV-PR-001', equipmentType: 'PRODUCTION' }],
    ])

    expect(resolveCalibrationLinkState('', equipmentMap)).toBe('UNLINKED')
    expect(resolveCalibrationLinkState('MISSING', equipmentMap)).toBe('ORPHAN')
    expect(resolveCalibrationLinkState('CEV-PR-001', equipmentMap)).toBe('INVALID_TYPE')
    expect(resolveCalibrationLinkState('CEV-ME-001', equipmentMap)).toBe('LINKED')
  })

  it('normalizes current calibration rows and preserves official ids', () => {
    const rows = normalizeCalibrationRows([
      {
        calibrationEquipmentId: 'CAL-2026-001',
        equipmentId: 'CEV-ME-001',
        controlNumber: 'CEV-ME-001',
        instrumentName: 'VERNIER CALIPERS',
        serialNumber: 'B16155514',
        lastCalibrationDate: '2026-07-01',
        nextDueDate: '2027-07-01',
        active: true,
      },
    ], [
      { equipmentId: 'CEV-ME-001', equipmentType: 'MEASUREMENT' },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      calibrationEquipmentId: 'CAL-2026-001',
      equipmentId: 'CEV-ME-001',
      controlNumber: 'CEV-ME-001',
      serialNumber: 'B16155514',
      linkState: 'LINKED',
      active: true,
    })
  })

  it('loads both canonical tables through backend client', async () => {
    const client = {
      readTable: async (table: string) => table === 'Calibration_Master'
        ? [{ calibrationEquipmentId: 'CAL-2026-052', equipmentId: 'CEV-ME-052', controlNumber: 'CEV-ME-052', instrumentName: 'Bộ quả cân 20g-2kg', active: 'TRUE' }]
        : [{ equipmentId: 'CEV-ME-052', equipmentType: 'MEASUREMENT' }],
    }

    const rows = await loadLiveCalibration(client as never)
    expect(rows).toHaveLength(1)
    expect(rows[0].linkState).toBe('LINKED')
    expect(rows[0].active).toBe(true)
  })
})
