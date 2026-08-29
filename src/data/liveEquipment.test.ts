import { describe, expect, it, vi } from 'vitest'
import { loadLiveEquipment, normalizeEquipmentRow } from './liveEquipment'

describe('live equipment repository', () => {
  it('normalizes Google Sheet values without inventing business data', () => {
    expect(normalizeEquipmentRow({
      equipmentId: 'CEV-ME-014',
      equipmentName: 'Digital Torque Meter HP-50',
      equipmentType: 'MEASUREMENT',
      model: 'HP-50',
      serialNumber: '0002422',
      usingDepartment: 'QC',
      active: 'TRUE',
      qrCode: 'CEV-ME-014',
    })).toMatchObject({
      equipmentId: 'CEV-ME-014',
      equipmentName: 'Digital Torque Meter HP-50',
      equipmentType: 'MEASUREMENT',
      model: 'HP-50',
      serialNumber: '0002422',
      usingDepartment: 'QC',
      active: true,
      qrCode: 'CEV-ME-014',
      status: 'RUNNING',
    })
  })

  it('rejects rows that are not canonical equipment roots', () => {
    expect(normalizeEquipmentRow({ equipmentId: '', equipmentType: 'MEASUREMENT' })).toBeNull()
    expect(normalizeEquipmentRow({ equipmentId: 'X', equipmentType: 'TOOLING' })).toBeNull()
  })

  it('loads Equipment_Master through the backend client', async () => {
    const readTable = vi.fn().mockResolvedValue([
      { equipmentId: 'PROD-1', equipmentName: 'Production', equipmentType: 'PRODUCTION', active: true },
      { equipmentId: 'CEV-ME-001', equipmentName: 'Caliper', equipmentType: 'MEASUREMENT', active: 'TRUE' },
    ])

    const rows = await loadLiveEquipment({ readTable })
    expect(readTable).toHaveBeenCalledWith('Equipment_Master')
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.equipmentType)).toEqual(['PRODUCTION', 'MEASUREMENT'])
  })
})
