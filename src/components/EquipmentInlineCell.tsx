import type { LiveEquipment } from '../data/liveEquipment'

type Props = {
  equipment: LiveEquipment
  columnKey: string
  label: string
  value: string | boolean | undefined
  onChange: (value: string | boolean) => void
}

const DATE_KEYS = new Set(['manufactureDate','inServiceDate','warrantyUntil'])
const BOOLEAN_KEYS = new Set(['controlsProductQuality','specialCharacteristicImpact','stopsProduction','hasBackup','capacityImpact'])

export function EquipmentInlineCell({ equipment, columnKey, label, value, onChange }: Props) {
  const ariaLabel = `${label} · ${equipment.equipmentId}`

  if (columnKey === 'status') {
    return <select className="equipment-inline-input" aria-label={ariaLabel} value={String(value || 'RUNNING')} onChange={(event) => onChange(event.target.value)}>
      <option value="RUNNING">Hoạt động</option>
      <option value="DOWN">Sự cố</option>
      <option value="MAINTENANCE">Bảo trì</option>
      <option value="STOPPED">Dừng</option>
      <option value="DISPOSED">Thanh lý</option>
      <option value="UNKNOWN">Chưa rõ</option>
    </select>
  }

  if (columnKey === 'defaultLabelSize') {
    return <select className="equipment-inline-input" aria-label={ariaLabel} value={String(value || 'standard')} onChange={(event) => onChange(event.target.value)}>
      <option value="tiny">15 × 25 mm</option>
      <option value="standard">30 × 50 mm</option>
      <option value="large">45 × 80 mm</option>
    </select>
  }

  if (columnKey === 'active') {
    return <select className="equipment-inline-input" aria-label={ariaLabel} value={value === false ? 'false' : 'true'} onChange={(event) => onChange(event.target.value === 'true')}>
      <option value="true">Đang quản lý</option>
      <option value="false">Ngừng quản lý</option>
    </select>
  }

  if (BOOLEAN_KEYS.has(columnKey)) {
    return <select className="equipment-inline-input" aria-label={ariaLabel} value={value === true ? 'true' : value === false ? 'false' : ''} onChange={(event) => onChange(event.target.value === 'true')}>
      <option value="">Chọn…</option>
      <option value="true">Có</option>
      <option value="false">Không</option>
    </select>
  }

  return <input
    className="equipment-inline-input"
    type={DATE_KEYS.has(columnKey) ? 'date' : 'text'}
    aria-label={ariaLabel}
    value={String(value ?? '')}
    onChange={(event) => onChange(event.target.value)}
    onFocus={(event) => event.currentTarget.select()}
    autoComplete="off"
  />
}
