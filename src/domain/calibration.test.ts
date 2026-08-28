import { describe, expect, it } from 'vitest'
import { CalibrationMasterSchema, getCalibrationDueStatus } from './calibration'

describe('calibration domain', () => {
  it('accepts a source-aligned calibration master record without a control number', () => {
    const parsed = CalibrationMasterSchema.parse({
      calibrationEquipmentId: 'CAL-HP50-001',
      department: 'QC',
      category: 'Digital Torque Meter',
      instrumentName: 'Digital Torque Meter HP-50',
      localName: 'Máy kiểm tra lực siết',
      operationalStatus: 'OK',
      model: 'HP-50',
      manufacturer: 'HIOS',
      purpose: 'Kiểm tra lực siết',
      lastCalibrationDate: '2024-06-28',
      nextDueDate: '2025-06-28',
      active: true,
    })

    expect(parsed.controlNumber).toBeUndefined()
    expect(parsed.instrumentName).toBe('Digital Torque Meter HP-50')
  })

  it('derives overdue, due-soon, valid and no-plan states', () => {
    expect(getCalibrationDueStatus('2025-06-28', '2026-08-28')).toBe('OVERDUE')
    expect(getCalibrationDueStatus('2026-09-10', '2026-08-28')).toBe('DUE_SOON')
    expect(getCalibrationDueStatus('2027-06-28', '2026-08-28')).toBe('VALID')
    expect(getCalibrationDueStatus(undefined, '2026-08-28')).toBe('NO_PLAN')
  })
})
