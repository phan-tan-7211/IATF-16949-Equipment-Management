import { useEffect, useMemo, useState } from 'react'
import './Calibration.css'
import { loadLiveCalibration, type CalibrationLinkState, type LiveCalibration } from './data/liveCalibration'
import { getCalibrationDueStatus } from './domain/calibration'

const linkLabel: Record<CalibrationLinkState, string> = {
  LINKED: 'Đã liên kết', UNLINKED: 'Chưa liên kết', ORPHAN: 'Mã gốc không tồn tại', INVALID_TYPE: 'Sai loại thiết bị',
}

type DueFilter = 'ALL' | 'OVERDUE' | 'DUE_SOON' | 'VALID' | 'NO_PLAN'

function dueLabel(value: string) {
  const labels: Record<string, string> = { OVERDUE: 'Quá hạn', DUE_SOON: 'Sắp đến hạn', VALID: 'Còn hạn', NO_PLAN: 'Chưa có hạn' }
  return labels[value] || value
}

export function LiveCalibrationPanel() {
  const [rows, setRows] = useState<LiveCalibration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [linkFilter, setLinkFilter] = useState<'ALL' | CalibrationLinkState>('ALL')
  const [dueFilter, setDueFilter] = useState<DueFilter>('ALL')
  const [selectedId, setSelectedId] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const reload = async () => {
    const result = await loadLiveCalibration()
    setRows(result)
    setError('')
  }

  useEffect(() => {
    let active = true
    loadLiveCalibration()
      .then((result) => { if (active) { setRows(result); setError('') } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Calibration Master') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedId('') }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId])

  const linked = rows.filter((row) => row.linkState === 'LINKED').length
  const reconciliation = rows.length - linked
  const overdue = rows.filter((row) => getCalibrationDueStatus(row.nextDueDate, today) === 'OVERDUE').length
  const dueSoon = rows.filter((row) => getCalibrationDueStatus(row.nextDueDate, today) === 'DUE_SOON').length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (linkFilter !== 'ALL' && row.linkState !== linkFilter) return false
    const due = getCalibrationDueStatus(row.nextDueDate, today)
    if (dueFilter !== 'ALL' && due !== dueFilter) return false
    if (!normalizedQuery) return true
    return [row.controlNumber, row.equipmentId, row.calibrationEquipmentId, row.instrumentName, row.localName, row.model, row.serialNumber, row.manufacturer, row.department]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedQuery)
  }), [rows, linkFilter, dueFilter, normalizedQuery, today])
  const selected = selectedId ? rows.find((row) => row.calibrationEquipmentId === selectedId) || null : null
  const selectedDue = selected ? getCalibrationDueStatus(selected.nextDueDate, today) : 'NO_PLAN'

  return <div className="calibration-page">
    <section className="calibration-summary" aria-label="Tổng quan hiệu chuẩn">
      <article><span>Tổng thiết bị đo</span><strong>{rows.length}</strong><small>Calibration Master</small></article>
      <article><span>Quá hạn</span><strong>{overdue}</strong><small>Cần xử lý ngay</small></article>
      <article><span>Sắp đến hạn</span><strong>{dueSoon}</strong><small>Cần lên kế hoạch</small></article>
      <article><span>Cần reconciliation</span><strong>{reconciliation}</strong><small>{linked} đã liên kết canonical</small></article>
    </section>

    <section className="calibration-surface" aria-labelledby="calibration-title">
      <header className="calibration-header">
        <div><p className="eyebrow">CEV-BM-STCL-03</p><h2 id="calibration-title">Calibration Control</h2><p>{filteredRows.length} / {rows.length} thiết bị · dữ liệu Supabase</p></div>
        <button type="button" onClick={() => void reload()}>Làm mới</button>
      </header>

      <div className="calibration-toolbar" role="search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm control no., mã máy, model, serial, tên thiết bị…" aria-label="Tìm thiết bị hiệu chuẩn" />
        <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)} aria-label="Lọc hạn hiệu chuẩn">
          <option value="ALL">Tất cả hạn</option><option value="OVERDUE">Quá hạn</option><option value="DUE_SOON">Sắp đến hạn</option><option value="VALID">Còn hạn</option><option value="NO_PLAN">Chưa có hạn</option>
        </select>
        <select value={linkFilter} onChange={(event) => setLinkFilter(event.target.value as typeof linkFilter)} aria-label="Lọc trạng thái liên kết">
          <option value="ALL">Tất cả liên kết</option><option value="LINKED">Đã liên kết</option><option value="UNLINKED">Chưa liên kết</option><option value="ORPHAN">Orphan</option><option value="INVALID_TYPE">Sai loại</option>
        </select>
      </div>

      {loading ? <div className="calibration-state" role="status">Đang tải Calibration Master…</div> : null}
      {error ? <div className="calibration-state error" role="alert">{error}</div> : null}

      {!loading && !error ? <div className="calibration-table-scroll"><table className="calibration-table">
        <thead><tr><th>Control No.</th><th>Thiết bị</th><th>Bộ phận</th><th>Model / Serial</th><th>Lần gần nhất</th><th>Hạn tiếp theo</th><th>Tình trạng</th><th>Liên kết</th><th /></tr></thead>
        <tbody>{filteredRows.map((item) => {
          const due = getCalibrationDueStatus(item.nextDueDate, today)
          return <tr key={item.calibrationEquipmentId}>
            <td><button className="calibration-link" type="button" onClick={() => setSelectedId(item.calibrationEquipmentId)}>{item.controlNumber || item.equipmentId || 'Chưa cấp'}</button><small>{item.equipmentId || item.calibrationEquipmentId}</small></td>
            <td><b>{item.instrumentName || item.localName || '—'}</b><small>{item.category || item.localName || '—'}</small></td>
            <td>{item.department || '—'}</td>
            <td>{item.model || '—'}<small>{item.serialNumber || '—'}</small></td>
            <td>{item.lastCalibrationDate || '—'}</td>
            <td>{item.nextDueDate || '—'}</td>
            <td><span className={`calibration-due due-${due.toLowerCase()}`}>{dueLabel(due)}</span></td>
            <td><span className={`calibration-link-state link-${item.linkState.toLowerCase()}`}>{linkLabel[item.linkState]}</span></td>
            <td><button className="calibration-row-action" type="button" onClick={() => setSelectedId(item.calibrationEquipmentId)}>Xem</button></td>
          </tr>
        })}</tbody>
      </table>{!filteredRows.length ? <div className="calibration-state">Không có thiết bị phù hợp.</div> : null}</div> : null}
    </section>

    {selected ? <div className="calibration-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId('') }}>
      <aside className="calibration-drawer" role="dialog" aria-modal="true" aria-labelledby="calibration-detail-title">
        <header><div><p className="eyebrow">Calibration Profile</p><h2 id="calibration-detail-title">{selected.controlNumber || selected.equipmentId || selected.calibrationEquipmentId}</h2><p>{selected.instrumentName || selected.localName || 'Thiết bị đo'}</p></div><button type="button" aria-label="Đóng" onClick={() => setSelectedId('')}>×</button></header>
        <div className="calibration-alert-row"><span className={`calibration-due due-${selectedDue.toLowerCase()}`}>{dueLabel(selectedDue)}</span><span className={`calibration-link-state link-${selected.linkState.toLowerCase()}`}>{linkLabel[selected.linkState]}</span></div>
        <div className="calibration-detail-grid">
          <div><span>Equipment ID</span><strong>{selected.equipmentId || '—'}</strong></div><div><span>Calibration ID</span><strong>{selected.calibrationEquipmentId}</strong></div>
          <div><span>Bộ phận</span><strong>{selected.department || '—'}</strong></div><div><span>Nhà sản xuất</span><strong>{selected.manufacturer || '—'}</strong></div>
          <div><span>Model</span><strong>{selected.model || '—'}</strong></div><div><span>Serial Number</span><strong>{selected.serialNumber || '—'}</strong></div>
          <div><span>Hiệu chuẩn gần nhất</span><strong>{selected.lastCalibrationDate || '—'}</strong></div><div><span>Hạn tiếp theo</span><strong>{selected.nextDueDate || '—'}</strong></div>
        </div>
        <section className="calibration-detail-section"><span>Thông số / độ chính xác</span><p>{selected.specification || selected.accuracy || '—'}</p></section>
        <section className="calibration-detail-section"><span>Phân loại / mô tả</span><p>{selected.category || selected.localName || '—'}</p></section>
      </aside>
    </div> : null}
  </div>
}
