import { useMemo, useState } from 'react'
import { EquipmentManagementLabel, type EquipmentLabelSize } from './EquipmentManagementLabel'
import './EquipmentLabelPrintWorkspace.css'

type Row = Record<string, unknown>

type Props = {
  records: Row[]
}

const SIZE_OPTIONS: Array<{ id: EquipmentLabelSize; label: string; width: number; height: number }> = [
  { id: 'compact', label: 'Nhỏ · 50 × 30 mm', width: 50, height: 30 },
  { id: 'standard', label: 'Tiêu chuẩn · 80 × 50 mm', width: 80, height: 50 },
  { id: 'large', label: 'Lớn · 100 × 60 mm', width: 100, height: 60 },
]

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

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

export function EquipmentLabelPrintWorkspace({ records }: Props) {
  const equipmentRows = useMemo(() => records.filter((row) => text(row, 'equipment_id')), [records])
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [size, setSize] = useState<EquipmentLabelSize>('standard')
  const [copies, setCopies] = useState(1)

  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    if (!words.length) return equipmentRows
    return equipmentRows.filter((row) => {
      const haystack = normalize([
        text(row, 'equipment_id'), text(row, 'equipment_name'), text(row, 'model'), text(row, 'manufacturer'),
        text(row, 'currentArea'), text(row, 'currentLine'), text(row, 'department'), text(row, 'usingDepartment'),
        text(row, 'managementResponsiblePrimary'), text(row, 'managementResponsibleSecondary'),
      ].join(' '))
      return words.every((word) => haystack.includes(word))
    })
  }, [equipmentRows, query])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedRows = useMemo(() => equipmentRows.filter((row) => selectedSet.has(text(row, 'equipment_id'))), [equipmentRows, selectedSet])
  const printableRows = useMemo(() => selectedRows.flatMap((row) => Array.from({ length: copies }, () => row)), [selectedRows, copies])
  const sizeConfig = SIZE_OPTIONS.find((option) => option.id === size) || SIZE_OPTIONS[1]
  const missingPrimaryCount = selectedRows.filter((row) => !text(row, 'managementResponsiblePrimary')).length

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  function selectFiltered() {
    setSelectedIds((current) => Array.from(new Set([...current, ...filtered.map((row) => text(row, 'equipment_id'))])))
  }

  function clearFiltered() {
    const filteredIds = new Set(filtered.map((row) => text(row, 'equipment_id')))
    setSelectedIds((current) => current.filter((id) => !filteredIds.has(id)))
  }

  function printLabels() {
    if (!printableRows.length) return
    const previousTitle = document.title
    document.title = `CEV Labels · ${selectedRows.length} thiết bị · ${sizeConfig.width}x${sizeConfig.height}mm`
    const style = document.createElement('style')
    style.id = 'equipment-label-page-size'
    style.textContent = `@media print { @page { size: ${sizeConfig.width}mm ${sizeConfig.height}mm; margin: 0; } }`
    document.head.appendChild(style)
    const restore = () => {
      style.remove()
      document.title = previousTitle
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore, { once: true })
    window.print()
  }

  return <div className="equipment-label-workspace">
    <section className="equipment-label-bulk-controls no-print">
      <div className="equipment-label-control-top">
        <label className="equipment-label-search"><span>Tìm thiết bị</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã, tên, model, line, người quản lý…" /></label>
        <label><span>Khổ tem</span><select value={size} onChange={(event) => setSize(event.target.value as EquipmentLabelSize)}>{SIZE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label><span>Số bản / máy</span><input type="number" min={1} max={20} value={copies} onChange={(event) => setCopies(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
      </div>
      <div className="equipment-label-bulk-actions">
        <button type="button" onClick={selectFiltered} disabled={!filtered.length}>Chọn tất cả kết quả ({filtered.length})</button>
        <button type="button" onClick={clearFiltered} disabled={!selectedIds.length}>Bỏ chọn kết quả</button>
        <strong>{selectedRows.length} máy · {printableRows.length} tem</strong>
        <button type="button" className="equipment-label-print-button" onClick={printLabels} disabled={!printableRows.length}>In {printableRows.length || ''} tem · {sizeConfig.width} × {sizeConfig.height} mm</button>
      </div>
      {missingPrimaryCount ? <div className="equipment-label-manager-warning" role="alert">⚠ {missingPrimaryCount} thiết bị đã chọn chưa có người phụ trách quản lý chính. Tem sẽ hiển thị “CHƯA PHÂN CÔNG”.</div> : null}
      <div className="equipment-label-picker" aria-label="Chọn thiết bị in tem">
        {filtered.map((row) => {
          const id = text(row, 'equipment_id')
          const checked = selectedSet.has(id)
          const primary = text(row, 'managementResponsiblePrimary')
          const secondary = text(row, 'managementResponsibleSecondary')
          return <label key={id} className={checked ? 'selected' : ''}>
            <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
            <span><strong>{id}</strong><b>{text(row, 'equipment_name') || 'Chưa có tên'}</b><small>QL chính: {primary || 'CHƯA PHÂN CÔNG'}{secondary ? ` · Phụ: ${secondary}` : ''}</small></span>
          </label>
        })}
      </div>
    </section>

    <section className={`equipment-label-preview-grid label-size-${size}`} aria-label="Xem trước tem sẽ in">
      {printableRows.length ? printableRows.map((row, index) => <div className="equipment-label-print-page" key={`${text(row, 'equipment_id')}-${index}`}><EquipmentManagementLabel row={row} size={size}/></div>) : <div className="equipment-label-empty no-print">Chọn một hoặc nhiều thiết bị để xem trước tem.</div>}
    </section>
  </div>
}
