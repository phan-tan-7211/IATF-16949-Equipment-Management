import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './Inspection.css'
import { canSubmitInspection, useAppRole } from './auth/AppRoleContext'
import {
  loadLiveInspection,
  submitLiveInspection,
  type DailyInspectionMark,
  type DailyInspectionShift,
  type WorkOrderPriority,
  type InspectionEquipmentOption,
  type LiveInspection,
} from './data/liveInspection'

const markLabel: Record<string, string> = {
  V: 'V · Tốt',
  URGENT_REPAIR: '○ · Sửa gấp',
  MAINTENANCE_REQUIRED: '△ · Cần bảo trì',
  STOP_REPAIR: 'X · Dừng máy',
}

type MarkFilter = 'ALL' | DailyInspectionMark

function operationId() {
  return `daily-inspection-${crypto.randomUUID()}`
}

export function LiveInspectionPanel() {
  const role = useAppRole()
  const canSubmit = canSubmitInspection(role)
  const [equipment, setEquipment] = useState<InspectionEquipmentOption[]>([])
  const [inspections, setInspections] = useState<LiveInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedInspectionId, setSelectedInspectionId] = useState('')
  const [query, setQuery] = useState('')
  const [markFilter, setMarkFilter] = useState<MarkFilter>('ALL')
  const [equipmentId, setEquipmentId] = useState('')
  const [shift, setShift] = useState<DailyInspectionShift>('MORNING')
  const [overallMark, setOverallMark] = useState<DailyInspectionMark>('V')
  const [note, setNote] = useState('')
  const [damagedParts, setDamagedParts] = useState('')
  const [priority, setPriority] = useState<WorkOrderPriority>('')

  const selectedEquipment = useMemo(() => equipment.find((item) => item.equipmentId === equipmentId) || null, [equipment, equipmentId])
  const selectedInspection = selectedInspectionId ? inspections.find((item) => item.inspectionId === selectedInspectionId) || null : null

  const applyResult = (result: Awaited<ReturnType<typeof loadLiveInspection>>) => {
    setEquipment(result.equipment)
    setInspections(result.inspections)
    setEquipmentId((current) => current || result.equipment[0]?.equipmentId || '')
    setError('')
  }

  const refresh = async () => applyResult(await loadLiveInspection())

  useEffect(() => {
    let active = true
    loadLiveInspection()
      .then((result) => { if (active) applyResult(result) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Daily Inspection') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!drawerOpen && !selectedInspectionId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDrawerOpen(false)
      setSelectedInspectionId('')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, selectedInspectionId])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return inspections.filter((item) => {
      if (markFilter !== 'ALL' && item.overallMark !== markFilter) return false
      if (!normalized) return true
      return [item.inspectionId, item.equipmentId, item.inspectorId, item.note, item.damagedParts, item.area]
        .filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized)
    })
  }, [inspections, query, markFilter])

  const today = new Date().toISOString().slice(0, 10)
  const todayRows = inspections.filter((item) => item.inspectionDate === today)
  const abnormalCount = todayRows.filter((item) => item.overallMark !== 'V').length
  const stopCount = todayRows.filter((item) => item.overallMark === 'STOP_REPAIR').length

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')
    if (!canSubmit) return setError(`Role ${role} không có quyền ghi kiểm tra.`)
    if (!equipmentId) return setError('Vui lòng chọn thiết bị')
    if (overallMark === 'STOP_REPAIR' && (!note.trim() || !priority)) return setError('Kết quả X bắt buộc nhập lý do và mức ưu tiên Work Order')

    setSubmitting(true)
    try {
      const response = await submitLiveInspection({
        operationId: operationId(), equipmentId, shift,
        area: selectedEquipment?.currentArea || '', overallMark, note, damagedParts, priority,
      })
      setMessage(`Đã lưu ${response.result.inspectionId}${response.result.workOrderId ? ` · WO ${response.result.workOrderId}` : ''}`)
      setNote(''); setDamagedParts(''); setPriority(''); setOverallMark('V'); setDrawerOpen(false)
      await refresh()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu kiểm tra')
    } finally { setSubmitting(false) }
  }

  return <div className="inspection-page">
    <section className="inspection-summary" aria-label="Tổng quan kiểm tra ngày">
      <article><span>Thiết bị sản xuất</span><strong>{equipment.length}</strong><small>Đang theo dõi</small></article>
      <article><span>Đã kiểm hôm nay</span><strong>{todayRows.length}</strong><small>{today}</small></article>
      <article><span>Bất thường hôm nay</span><strong>{abnormalCount}</strong><small>○ / △ / X</small></article>
      <article><span>Dừng máy</span><strong>{stopCount}</strong><small>Tự tạo WO + Downtime</small></article>
    </section>

    <section className="inspection-surface" aria-labelledby="inspection-title">
      <header className="inspection-header">
        <div><p className="eyebrow">BM-KTTBHN</p><h2 id="inspection-title">Daily Inspection</h2><p>{filtered.length} / {inspections.length} bản ghi gần nhất</p></div>
        <div className="inspection-header-actions"><button type="button" onClick={() => void refresh()}>Làm mới</button>{canSubmit ? <button className="inspection-primary" type="button" onClick={() => setDrawerOpen(true)}>+ Kiểm tra mới</button> : <span className="inspection-readonly">Chỉ xem · {role}</span>}</div>
      </header>

      <div className="inspection-legend"><span className="ok">V · Tốt</span><span>○ · Sửa gấp</span><span>△ · Bảo trì</span><span className="danger">X · Dừng máy</span></div>
      <div className="inspection-toolbar" role="search">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã kiểm tra, thiết bị, người kiểm, ghi chú…" aria-label="Tìm lịch sử kiểm tra" />
        <select value={markFilter} onChange={(event) => setMarkFilter(event.target.value as MarkFilter)} aria-label="Lọc kết quả">
          <option value="ALL">Tất cả kết quả</option><option value="V">V · Tốt</option><option value="URGENT_REPAIR">○ · Sửa gấp</option><option value="MAINTENANCE_REQUIRED">△ · Cần bảo trì</option><option value="STOP_REPAIR">X · Dừng máy</option>
        </select>
      </div>

      {message ? <div className="inspection-feedback" role="status">{message}</div> : null}
      {error ? <div className="inspection-state error" role="alert">{error}</div> : null}
      {loading ? <div className="inspection-state" role="status">Đang tải Daily Inspection…</div> : null}

      {!loading && !error ? <div className="inspection-table-scroll"><table className="inspection-table">
        <thead><tr><th>Mã</th><th>Thiết bị</th><th>Ngày / ca</th><th>Kết quả</th><th>Người kiểm</th><th>Ghi chú</th><th /></tr></thead>
        <tbody>{filtered.map((item) => <tr key={item.inspectionId}>
          <td><button className="inspection-link" type="button" onClick={() => setSelectedInspectionId(item.inspectionId)}>{item.inspectionId}</button></td>
          <td><b>{item.equipmentId}</b><small>{item.area || '—'}</small></td>
          <td>{item.inspectionDate}<small>{item.shift || '—'}</small></td>
          <td><span className={`inspection-mark mark-${item.overallMark.toLowerCase()}`}>{markLabel[item.overallMark] || item.overallMark}</span></td>
          <td>{item.inspectorId || '—'}</td><td>{item.note || '—'}</td>
          <td><button className="inspection-row-action" type="button" onClick={() => setSelectedInspectionId(item.inspectionId)}>Xem</button></td>
        </tr>)}</tbody>
      </table>{!filtered.length ? <div className="inspection-state">Không có bản ghi phù hợp.</div> : null}</div> : null}
    </section>

    {drawerOpen && canSubmit ? <div className="inspection-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false) }}>
      <aside className="inspection-drawer" role="dialog" aria-modal="true" aria-labelledby="inspection-create-title">
        <header><div><p className="eyebrow">Daily Inspection</p><h2 id="inspection-create-title">Kiểm tra thiết bị</h2><p>{selectedEquipment?.equipmentName || 'Chọn thiết bị'}</p></div><button type="button" aria-label="Đóng" onClick={() => setDrawerOpen(false)}>×</button></header>
        <form className="inspection-form" onSubmit={onSubmit}>
          <label><span>Thiết bị</span><select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>{equipment.map((item) => <option key={item.equipmentId} value={item.equipmentId}>{item.equipmentId} · {item.equipmentName}</option>)}</select></label>
          <label><span>Ca kiểm tra</span><select value={shift} onChange={(event) => setShift(event.target.value as DailyInspectionShift)}><option value="MORNING">Ca sáng</option><option value="AFTERNOON">Ca chiều</option><option value="NIGHT">Ca đêm</option></select></label>
          <label><span>Kết quả</span><select value={overallMark} onChange={(event) => { const next = event.target.value as DailyInspectionMark; setOverallMark(next); if (next !== 'STOP_REPAIR') setPriority('') }}><option value="V">V · Tốt</option><option value="URGENT_REPAIR">○ · Sửa gấp</option><option value="MAINTENANCE_REQUIRED">△ · Cần bảo trì</option><option value="STOP_REPAIR">X · Dừng máy</option></select></label>
          <label><span>Ghi chú</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mô tả bất thường nếu có" /></label>
          <label><span>Bộ phận hư hỏng</span><input value={damagedParts} onChange={(event) => setDamagedParts(event.target.value)} /></label>
          {overallMark === 'STOP_REPAIR' ? <label><span>Mức ưu tiên Work Order</span><select value={priority} onChange={(event) => setPriority(event.target.value as WorkOrderPriority)} required><option value="">Chọn mức ưu tiên</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label> : null}
          <div className="inspection-warning">Kết quả <b>X</b> sẽ tạo Work Order + Downtime Event và chuyển thiết bị sang DOWN trong cùng RPC transaction.</div>
          <footer><button type="button" onClick={() => setDrawerOpen(false)}>Hủy</button><button className="inspection-primary" type="submit" disabled={submitting || !equipment.length}>{submitting ? 'Đang lưu…' : 'Lưu kiểm tra'}</button></footer>
        </form>
      </aside>
    </div> : null}

    {selectedInspection ? <div className="inspection-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedInspectionId('') }}>
      <aside className="inspection-drawer" role="dialog" aria-modal="true" aria-labelledby="inspection-detail-title">
        <header><div><p className="eyebrow">Inspection Record</p><h2 id="inspection-detail-title">{selectedInspection.inspectionId}</h2><p>{selectedInspection.equipmentId}</p></div><button type="button" aria-label="Đóng" onClick={() => setSelectedInspectionId('')}>×</button></header>
        <div className="inspection-detail-grid"><div><span>Ngày</span><strong>{selectedInspection.inspectionDate}</strong></div><div><span>Ca</span><strong>{selectedInspection.shift || '—'}</strong></div><div><span>Kết quả</span><strong>{markLabel[selectedInspection.overallMark] || selectedInspection.overallMark}</strong></div><div><span>Người kiểm</span><strong>{selectedInspection.inspectorId || '—'}</strong></div><div><span>Khu vực</span><strong>{selectedInspection.area || '—'}</strong></div><div><span>Bộ phận hư hỏng</span><strong>{selectedInspection.damagedParts || '—'}</strong></div></div>
        <section className="inspection-detail-section"><span>Ghi chú</span><p>{selectedInspection.note || '—'}</p></section>
      </aside>
    </div> : null}
  </div>
}
