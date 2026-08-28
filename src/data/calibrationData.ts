import type { CalibrationMaster } from '../domain/calibration'

/**
 * Small local sample transcribed from source/DANH SÁCH THIẾT BỊ  HIỆU CHUẨN (2024.06.01).md.
 * This is a historical source snapshot for UI/schema validation, not live company status.
 * Vendor quotation/cost columns are intentionally excluded from the product domain.
 */
export const CALIBRATION_SOURCE_SNAPSHOT = '2024-06-01'

export const mockCalibrationMaster: CalibrationMaster[] = [
  {
    calibrationEquipmentId: 'CAL-CEV-TB-113', equipmentId: 'CEV-TB-113', controlNumber: 'CEV-TB-113', department: 'QC', category: 'Weight', instrumentName: 'ELECTRONIC SCALE', localName: 'Cân', operationalStatus: 'OK', specification: '0.001g-220g', accuracy: '0.001', model: 'EB-220HU', manufacturer: 'SHIMADZU', serialNumber: '00799', purpose: 'Kiểm tra trọng lượng', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true,
  },
  {
    calibrationEquipmentId: 'CAL-HP50-001', department: 'QC', category: 'Torque', instrumentName: 'Digital Torque Meter HP-50', localName: 'Máy kiểm tra lực siết', operationalStatus: 'OK', model: 'HP-50', manufacturer: 'HIOS', purpose: 'Kiểm tra lực siết', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true,
  },
  {
    calibrationEquipmentId: 'CAL-CEV-TB-301', equipmentId: 'CEV-TB-301', controlNumber: 'CEV-TB-301', department: 'QC', category: 'Thickness', instrumentName: 'FILM THICKNESS METER', localName: 'Máy kiểm tra độ dày sơn', operationalStatus: 'OK', specification: '0~603μm', accuracy: '1μm', model: '456', manufacturer: 'Elcometer', purpose: 'Kiểm tra độ dày lớp phủ sơn', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true,
  },
  {
    calibrationEquipmentId: 'CAL-CEV-TB-401', equipmentId: 'CEV-TB-401', controlNumber: 'CEV-TB-401', department: 'QC', category: 'Voltage', instrumentName: 'PUNTURE TESTER', localName: 'Máy đo điện áp', operationalStatus: 'OK', specification: '0KV - 5 KV', model: 'ILO PT2013', manufacturer: 'ILOSAM ENG', serialNumber: 'PT2013-17230', purpose: 'Kiểm tra điện áp', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true,
  },
  {
    calibrationEquipmentId: 'CAL-CEV-TB-001', equipmentId: 'CEV-TB-001', controlNumber: 'CEV-TB-001', department: 'QC', category: 'LCR', instrumentName: 'LCR METER', localName: 'Meter', operationalStatus: 'OK', specification: '20Hz - 1MHz', model: 'HP4284A', manufacturer: 'Agilent', serialNumber: '2940307919', purpose: 'Kiểm tra giá trị cuộn cảm LCR', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true,
  },
  {
    calibrationEquipmentId: 'CAL-TH9201-01', department: 'COIL', category: 'HIPOT', instrumentName: 'TH9201 HIPOT TESTER', operationalStatus: 'OK', model: 'TH9201', manufacturer: 'TONGHUI', serialNumber: 'N06819104', purpose: 'Kiểm tra short giữa coil và core', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true,
  },
  {
    calibrationEquipmentId: 'CAL-TENSION-001', department: 'COIL', category: 'Tension', instrumentName: 'TENSION METER', localName: 'Kiểm tra độ căng dây', operationalStatus: 'OK', specification: '0.5N', purpose: 'Kiểm tra lực căng dây', instrumentStatus: 'ACTIVE', active: true,
  },
]
