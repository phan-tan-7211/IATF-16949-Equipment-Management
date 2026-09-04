import { EquipmentQr } from './EquipmentQr'
import './EquipmentManagementLabel.css'

type Row = Record<string, unknown>

type Props = {
  row: Row
}

function sourceData(row: Row) {
  const value = row.source_data
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function text(row: Row, key: string) {
  const direct = row[key]
  if (direct !== null && direct !== undefined && String(direct).trim()) return String(direct).trim()
  const nested = sourceData(row)[key]
  return nested === null || nested === undefined ? '' : String(nested).trim()
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    RUNNING: 'HOẠT ĐỘNG',
    DOWN: 'SỰ CỐ',
    MAINTENANCE: 'BẢO TRÌ',
    STOPPED: 'DỪNG',
    DISPOSED: 'THANH LÝ',
  }
  return labels[value.toUpperCase()] || value || 'CHƯA XÁC ĐỊNH'
}

export function EquipmentManagementLabel({ row }: Props) {
  const equipmentId = text(row, 'equipment_id')
  const equipmentName = text(row, 'equipment_name')
  const qrValue = text(row, 'qr_code') || equipmentId
  const area = text(row, 'currentArea')
  const line = text(row, 'currentLine')
  const department = text(row, 'department') || text(row, 'usingDepartment')
  const criticality = text(row, 'criticality')
  const status = text(row, 'status')
  const location = [area, line].filter(Boolean).join(' · ')

  return <section className="equipment-management-label" aria-label={`Tem quản lý ${equipmentId}`}>
    <header>
      <div>
        <strong>CORE ELECTRONICS VIETNAM</strong>
        <span>TEM QUẢN LÝ THIẾT BỊ</span>
      </div>
      {criticality ? <b className="equipment-label-criticality">CẤP {criticality}</b> : null}
    </header>

    <div className="equipment-label-body">
      <div className="equipment-label-main">
        <div className="equipment-label-id">{equipmentId || '—'}</div>
        <div className="equipment-label-name">{equipmentName || 'Chưa có tên thiết bị'}</div>
        <dl>
          <div><dt>Vị trí</dt><dd>{location || '—'}</dd></div>
          <div><dt>Bộ phận</dt><dd>{department || '—'}</dd></div>
        </dl>
        <div className="equipment-label-status">{statusLabel(status)}</div>
      </div>

      <div className="equipment-label-qr">
        <EquipmentQr value={qrValue} size={150} label="" />
        <span>QUÉT ĐỂ MỞ HỒ SƠ</span>
      </div>
    </div>
  </section>
}
