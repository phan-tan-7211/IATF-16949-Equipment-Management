import { useEffect, useMemo, useState } from 'react'
import './EquipmentInventory.css'
import { LiveQrScannerPanel } from './LiveQrScannerPanel'
import {
  closeEquipmentInventorySession,
  createEquipmentInventorySession,
  getEquipmentInventoryCacheSnapshot,
  loadEquipmentInventory,
  recordEquipmentInventory,
  type EquipmentInventoryEquipment,
  type EquipmentInventorySnapshot,
  type EquipmentInventorySource,
  type EquipmentInventoryStatus,
} from './data/liveEquipmentInventory'

const EMPTY: EquipmentInventorySnapshot = { equipment: [], sessions: [], results: [] }

const STATUS_LABEL: Record<EquipmentInventoryStatus, string> = {
  FOUND_LABEL_OK: 'Có máy + có tem QR',
  FOUND_NO_LABEL: 'Có máy · thiếu tem QR',
  MOVED: 'Sai vị trí',
  NOT_FOUND: 'Không tìm thấy',
  DATA_INVALID: 'Data rác / sai master',
}

function searchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

function currentInventoryName() {
  const now = new Date()
  return `Kiểm kê ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export function LiveEquipmentInventoryPanel() {
  const cached = getEquipmentInventoryCacheSnapshot()
  const [snapshot, setSnapshot] = useState<EquipmentInventorySnapshot>(() => cached || EMPTY)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState(() => cached?.sessions.find((item) => item.status === 'OPEN')?.sessionId || cached?.sessions[0]?.sessionId || '')
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'SCAN' | 'MANUAL'>('SCAN')
  const [scannerKey, setScannerKey] = useState(0)
  const [manualQuery, setManualQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedSource, setSelectedSource] = useState<EquipmentInventorySource>('MANUAL')
  const [moveOpen, setMoveOpen] = useState(false)
  const [actualArea, setActualArea] = useState('')
  const [actualLine, setActualLine] = useState('')
  const [moveLabelOk, setMoveLabelOk] = useState<boolean | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let active = true
    const existing = getEquipmentInventoryCacheSnapshot()
    if (existing) {
      setSnapshot(existing)
      setLoading(false)
    }
    void loadEquipmentInventory({ force: Boolean(existing) })
      .then((result) => {
        if (!active) return
        setSnapshot(result)
        setError('')
        setSessionId((current) => current || result.sessions.find((item) => item.status === 'OPEN')?.sessionId || result.sessions[0]?.sessionId || '')
      })
      .catch((cause) => {
        if (active && !existing) setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu kiểm kê')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const activeSession = snapshot.sessions.find((item) => item.sessionId === sessionId) || null
  const sessionResults = useMemo(() => snapshot.results.filter((item) => item.sessionId === sessionId), [snapshot.results, sessionId])
  const resultByEquipment = useMemo(() => new Map(sessionResults.map((item) => [item.equipmentId, item])), [sessionResults])
  const selectedEquipment = selectedId ? snapshot.equipment.find((item) => item.equipmentId === selectedId) || null : null
  const checkedCount = sessionResults.length
  const missingLabelCount = sessionResults.filter((item) => item.status === 'FOUND_NO_LABEL' || (item.status === 'MOVED' && item.labelOk === false)).length
  const movedCount = sessionResults.filter((item) => item.status === 'MOVED').length
  const notFoundCount = sessionResults.filter((item) => item.status === 'NOT_FOUND').length
  const invalidCount = sessionResults.filter((item) => item.status === 'DATA_INVALID').length
  const pendingCount = Math.max(snapshot.equipment.length - checkedCount, 0)

  const manualMatches = useMemo(() => {
    const words = searchText(manualQuery).split(/\s+/).filter(Boolean)
    if (!words.length) return snapshot.equipment.filter((item) => !resultByEquipment.has(item.equipmentId)).slice(0, 20)
    return snapshot.equipment.filter((item) => {
      const value = searchText(`${item.equipmentId} ${item.equipmentName} ${item.area} ${item.line}`)
      return words.every((word) => value.includes(word))
    }).slice(0, 30)
  }, [manualQuery, resultByEquipment, snapshot.equipment])

  const abnormalResults = useMemo(() => sessionResults.filter((item) => item.status !== 'FOUND_LABEL_OK').slice(0, 50), [sessionResults])

  function refreshFromCache() {
    const next = getEquipmentInventoryCacheSnapshot()
    if (next) setSnapshot(next)
  }

  function resetSelection(nextMode = mode) {
    setSelectedId('')
    setMoveOpen(false)
    setActualArea('')
    setActualLine('')
    setMoveLabelOk(null)
    setNote('')
    setMode(nextMode)
    if (nextMode === 'SCAN') setScannerKey((value) => value + 1)
  }

  async function createSession() {
    if (creating) return
    setCreating(true)
    setError('')
    setMessage('')
    try {
      const session = await createEquipmentInventorySession(currentInventoryName())
      refreshFromCache()
      setSessionId(session.sessionId)
      resetSelection('SCAN')
      setMessage(`Đã mở ${session.name}.`)
    } catch (cause) {
      refreshFromCache()
      setError(cause instanceof Error ? cause.message : 'Không tạo được đợt kiểm kê')
    } finally {
      setCreating(false)
    }
  }

  async function saveStatus(status: EquipmentInventoryStatus, options: { labelOk?: boolean | null; actualArea?: string; actualLine?: string } = {}) {
    if (!activeSession || activeSession.status !== 'OPEN' || !selectedEquipment || saving) return
    if (status === 'MOVED' && !options.actualArea?.trim() && !options.actualLine?.trim()) {
      setError('Nhập khu vực hoặc dây chuyền thực tế trước khi lưu.')
      return
    }
    if (status === 'MOVED' && options.labelOk == null) {
      setError('Xác nhận tem QR hiện còn hay đã mất.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await recordEquipmentInventory({
        sessionId: activeSession.sessionId,
        equipmentId: selectedEquipment.equipmentId,
        status,
        labelOk: options.labelOk,
        actualArea: options.actualArea,
        actualLine: options.actualLine,
        note,
        source: selectedSource,
      })
      refreshFromCache()
      setMessage(`${result.equipmentId} · ${STATUS_LABEL[result.status]} · đã lưu.`)
      resetSelection(selectedSource === 'QR' ? 'SCAN' : 'MANUAL')
    } catch (cause) {
      refreshFromCache()
      setError(cause instanceof Error ? cause.message : 'Không lưu được kết quả kiểm kê')
    } finally {
      setSaving(false)
    }
  }

  async function closeSession() {
    if (!activeSession || activeSession.status !== 'OPEN' || closing) return
    if (!window.confirm(`Kết thúc ${activeSession.name}?\n\nCòn ${pendingCount} thiết bị chưa kiểm. Hệ thống sẽ giữ nguyên chúng ở trạng thái chưa kiểm, không tự đánh dấu thất lạc.`)) return
    setClosing(true)
    setError('')
    try {
      await closeEquipmentInventorySession(activeSession.sessionId)
      refreshFromCache()
      setMessage(`Đã kết thúc ${activeSession.name}.`)
      resetSelection('MANUAL')
    } catch (cause) {
      refreshFromCache()
      setError(cause instanceof Error ? cause.message : 'Không kết thúc được đợt kiểm kê')
    } finally {
      setClosing(false)
    }
  }

  function chooseEquipment(equipment: EquipmentInventoryEquipment, source: EquipmentInventorySource) {
    setSelectedId(equipment.equipmentId)
    setSelectedSource(source)
    setMoveOpen(false)
    setActualArea(equipment.area)
    setActualLine(equipment.line)
    setMoveLabelOk(source === 'QR' ? true : null)
    setNote('')
    setError('')
  }

  if (loading && !snapshot.equipment.length) return <div className="inventory-state" role="status">Đang tải dữ liệu kiểm kê…</div>

  return <div className="inventory-page">
    <section className="inventory-header">
      <div>
        <p className="eyebrow">Equipment Inventory</p>
        <h2>Kiểm kê thiết bị</h2>
        <p>Đi hiện trường → quét tem QR → xác nhận. Chỉ nhập thêm khi thiếu tem, sai vị trí, thất lạc hoặc data rác.</p>
      </div>
      <div className="inventory-session-controls">
        {snapshot.sessions.length ? <select value={sessionId} onChange={(event) => { setSessionId(event.target.value); resetSelection('MANUAL') }} aria-label="Đợt kiểm kê">
          {snapshot.sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.name} · {session.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}</option>)}
        </select> : null}
        <button type="button" onClick={() => void createSession()} disabled={creating}>{creating ? 'Đang tạo…' : '+ Đợt kiểm kê mới'}</button>
      </div>
    </section>

    {error ? <div className="inventory-feedback error" role="alert">{error}</div> : null}
    {message ? <div className="inventory-feedback" role="status">{message}</div> : null}

    {!activeSession ? <section className="inventory-empty">
      <strong>Chưa có đợt kiểm kê.</strong>
      <span>Tạo đợt kiểm kê rồi bắt đầu quét QR ngoài hiện trường.</span>
      <button type="button" onClick={() => void createSession()} disabled={creating}>{creating ? 'Đang tạo…' : `Bắt đầu ${currentInventoryName()}`}</button>
    </section> : <>
      <section className="inventory-session-bar">
        <div><span>Đợt kiểm kê</span><strong>{activeSession.name}</strong><small>{activeSession.status === 'OPEN' ? `Bắt đầu ${formatDate(activeSession.startedAt)}` : `Đã đóng ${formatDate(activeSession.closedAt)}`}</small></div>
        {activeSession.status === 'OPEN' ? <button type="button" onClick={() => void closeSession()} disabled={closing}>{closing ? 'Đang kết thúc…' : 'Kết thúc đợt'}</button> : <span className="inventory-closed-badge">ĐÃ ĐÓNG</span>}
      </section>

      <section className="inventory-summary" aria-label="Tổng hợp kiểm kê">
        <article><span>Đã kiểm</span><strong>{checkedCount}</strong><small>/ {snapshot.equipment.length}</small></article>
        <article className={missingLabelCount ? 'warning' : ''}><span>Thiếu tem QR</span><strong>{missingLabelCount}</strong></article>
        <article className={movedCount ? 'warning' : ''}><span>Sai vị trí</span><strong>{movedCount}</strong></article>
        <article className={notFoundCount ? 'danger' : ''}><span>Không tìm thấy</span><strong>{notFoundCount}</strong></article>
        <article className={invalidCount ? 'danger' : ''}><span>Data rác</span><strong>{invalidCount}</strong></article>
        <article><span>Chưa kiểm</span><strong>{pendingCount}</strong></article>
      </section>

      {activeSession.status === 'OPEN' ? <section className="inventory-workspace">
        {!selectedEquipment ? <>
          <div className="inventory-mode-tabs" role="tablist" aria-label="Cách kiểm kê">
            <button type="button" className={mode === 'SCAN' ? 'active' : ''} onClick={() => setMode('SCAN')}>▣ Quét QR</button>
            <button type="button" className={mode === 'MANUAL' ? 'active' : ''} onClick={() => setMode('MANUAL')}>⌕ Tìm thiết bị không có tem</button>
          </div>

          {mode === 'SCAN' ? <div className="equipment-inventory-scanner">
            <div className="inventory-scan-note"><strong>Tem quản lý = QR.</strong><span>Quét được QR nghĩa là tem đang có. Sau khi quét chỉ cần xác nhận máy còn đúng vị trí.</span></div>
            <LiveQrScannerPanel key={scannerKey} onOpenEquipment={(equipmentId) => {
              const equipment = snapshot.equipment.find((item) => item.equipmentId === equipmentId)
              if (equipment) chooseEquipment(equipment, 'QR')
            }}/>
          </div> : <div className="inventory-manual-finder">
            <label>
              <span>Tìm mã / tên / khu vực / dây chuyền</span>
              <input value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="Ví dụ CEV-PR-021, Coil, Line A…" autoFocus />
            </label>
            <div className="inventory-manual-list">
              {manualMatches.length ? manualMatches.map((equipment) => {
                const existing = resultByEquipment.get(equipment.equipmentId)
                return <button type="button" key={equipment.equipmentId} onClick={() => chooseEquipment(equipment, 'MANUAL')}>
                  <strong>{equipment.equipmentId}</strong>
                  <span>{equipment.equipmentName}</span>
                  <small>{[equipment.area, equipment.line].filter(Boolean).join(' · ') || 'Chưa có vị trí'}{existing ? ` · ${STATUS_LABEL[existing.status]}` : ''}</small>
                </button>
              }) : <div className="inventory-no-match">Không tìm thấy thiết bị phù hợp.</div>}
            </div>
          </div>}
        </> : <div className="inventory-confirm-card">
          <header>
            <button type="button" className="inventory-back" onClick={() => resetSelection(selectedSource === 'QR' ? 'SCAN' : 'MANUAL')}>← Quay lại</button>
            <span>{selectedSource === 'QR' ? 'ĐÃ QUÉT QR' : 'CHỌN THỦ CÔNG'}</span>
          </header>
          <div className="inventory-equipment-title">
            <strong>{selectedEquipment.equipmentId}</strong>
            <h3>{selectedEquipment.equipmentName}</h3>
            <p>Vị trí hệ thống: {[selectedEquipment.area, selectedEquipment.line].filter(Boolean).join(' · ') || 'Chưa khai báo'}</p>
          </div>

          {selectedSource === 'QR' && !moveOpen ? <div className="inventory-primary-actions">
            <button type="button" className="confirm" onClick={() => void saveStatus('FOUND_LABEL_OK')} disabled={saving}>{saving ? 'Đang lưu…' : '✓ XÁC NHẬN ĐÃ KIỂM KÊ'}</button>
            <button type="button" onClick={() => { setMoveOpen(true); setMoveLabelOk(true) }} disabled={saving}>↔ Máy đang ở sai vị trí</button>
          </div> : null}

          {selectedSource === 'MANUAL' && !moveOpen ? <div className="inventory-status-actions">
            <button type="button" className="warning" onClick={() => void saveStatus('FOUND_NO_LABEL')} disabled={saving}>Có máy · thiếu/mất tem QR</button>
            <button type="button" onClick={() => { setMoveOpen(true); setMoveLabelOk(null) }} disabled={saving}>Sai vị trí</button>
            <button type="button" className="danger" onClick={() => void saveStatus('NOT_FOUND')} disabled={saving}>Không tìm thấy</button>
            <button type="button" className="danger" onClick={() => void saveStatus('DATA_INVALID')} disabled={saving}>Data rác / sai master</button>
            <button type="button" onClick={() => void saveStatus('FOUND_LABEL_OK')} disabled={saving}>Có máy + có tem QR</button>
          </div> : null}

          {moveOpen ? <div className="inventory-move-form">
            <h4>Vị trí thực tế</h4>
            <div className="inventory-location-grid">
              <label><span>Khu vực</span><input value={actualArea} onChange={(event) => setActualArea(event.target.value)} placeholder="Khu vực thực tế" /></label>
              <label><span>Dây chuyền</span><input value={actualLine} onChange={(event) => setActualLine(event.target.value)} placeholder="Dây chuyền thực tế" /></label>
            </div>
            <fieldset>
              <legend>Tem QR hiện tại</legend>
              <label><input type="radio" name="move-label" checked={moveLabelOk === true} onChange={() => setMoveLabelOk(true)} /> Còn tem QR</label>
              <label><input type="radio" name="move-label" checked={moveLabelOk === false} onChange={() => setMoveLabelOk(false)} /> Thiếu / mất tem QR</label>
            </fieldset>
            <label className="inventory-note"><span>Ghi chú (nếu cần)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Ví dụ chuyển sang Line B…" /></label>
            <div className="inventory-move-actions"><button type="button" onClick={() => setMoveOpen(false)} disabled={saving}>Hủy</button><button type="button" className="confirm" onClick={() => void saveStatus('MOVED', { actualArea, actualLine, labelOk: moveLabelOk })} disabled={saving || moveLabelOk == null}>{saving ? 'Đang lưu…' : 'Lưu sai vị trí'}</button></div>
          </div> : null}

          {!moveOpen && selectedSource === 'MANUAL' ? <label className="inventory-note"><span>Ghi chú cho bất thường (không bắt buộc)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Lý do / thông tin kiểm tra thêm…" /></label> : null}
        </div>}
      </section> : null}

      <section className="inventory-exceptions">
        <header><div><p className="eyebrow">Ngoại lệ</p><h3>Cần xử lý sau kiểm kê</h3></div><span>{abnormalResults.length}</span></header>
        {abnormalResults.length ? <div className="inventory-exception-list">{abnormalResults.map((result) => {
          const equipment = snapshot.equipment.find((item) => item.equipmentId === result.equipmentId)
          return <article key={`${result.sessionId}-${result.equipmentId}`}>
            <div><strong>{result.equipmentId}</strong><span>{equipment?.equipmentName || 'Thiết bị không còn trong master'}</span></div>
            <b className={`status-${result.status.toLowerCase()}`}>{STATUS_LABEL[result.status]}</b>
            <small>{result.status === 'MOVED' ? `Thực tế: ${[result.actualArea, result.actualLine].filter(Boolean).join(' · ')} · ${result.labelOk ? 'Tem QR còn' : 'Thiếu tem QR'}` : result.note || formatDate(result.checkedAt)}</small>
          </article>
        })}</div> : <div className="inventory-clean-state">Chưa có bất thường trong đợt này.</div>}
      </section>
    </>}
  </div>
}
