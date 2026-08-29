import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createAppsScriptBridgeClient, type DailyInspectionMark, type DailyInspectionShift, type WorkOrderPriority } from './data/appsScriptBridgeClient'
import { loadLiveInspection, submitLiveInspection, type InspectionEquipmentOption, type LiveInspection } from './data/liveInspection'

const markLabel: Record<string, string> = {
  V: 'V · Tốt',
  URGENT_REPAIR: '○ · Sửa gấp',
  MAINTENANCE_REQUIRED: '△ · Cần bảo trì',
  STOP_REPAIR: 'X · Hư hỏng / dừng máy',
}

export function LiveInspectionPanel() {
  const [equipment, setEquipment] = useState<InspectionEquipmentOption[]>([])
  const [inspections, setInspections] = useState<LiveInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [shift, setShift] = useState<DailyInspectionShift>('MORNING')
  const [overallMark, setOverallMark] = useState<DailyInspectionMark>('V')
  const [note, setNote] = useState('')
  const [damagedParts, setDamagedParts] = useState('')
  const [priority, setPriority] = useState<WorkOrderPriority>('')

  const selectedEquipment = useMemo(
    () => equipment.find((item) => item.equipmentId === equipmentId) || null,
    [equipment, equipmentId],
  )

  const refresh = async () => {
    const client = createAppsScriptBridgeClient()
    try {
      const result = await loadLiveInspection(client)
      setEquipment(result.equipment)
      setInspections(result.inspections)
      setEquipmentId((current) => current || result.equipment[0]?.equipmentId || '')
      setError('')
    } finally {
      client.destroy()
    }
  }

  useEffect(() => {
    let active = true
    const client = createAppsScriptBridgeClient()

    loadLiveInspection(client)
      .then((result) => {
        if (!active) return
        setEquipment(result.equipment)
        setInspections(result.inspections)
        setEquipmentId(result.equipment[0]?.equipmentId || '')
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải Daily Inspection')
      })
      .finally(() => {
        if (active) setLoading(false)
        client.destroy()
      })

    return () => {
      active = false
      client.destroy()
    }
  }, [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!equipmentId) {
      setError('Vui lòng chọn thiết bị')
      return
    }
    if (overallMark === 'STOP_REPAIR' && (!note.trim() || !priority)) {
      setError('Kết quả X bắt buộc nhập lý do và mức ưu tiên Work Order')
      return
    }

    const client = createAppsScriptBridgeClient()
    setSubmitting(true)
    try {
      const operationId = `daily-inspection-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const response = await submitLiveInspection(client, {
        operationId,
        equipmentId,
        shift,
        area: selectedEquipment?.currentArea || '',
        overallMark,
        note,
        damagedParts,
        priority,
      })
      const extra = response.result.workOrderId ? ` · WO ${response.result.workOrderId}` : ''
      setMessage(`Đã lưu ${response.result.inspectionId}${extra}`)
      setNote('')
      setDamagedParts('')
      setPriority('')
      setOverallMark('V')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu kiểm tra')
    } finally {
      client.destroy()
      setSubmitting(false)
    }

    try {
      await refresh()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Đã lưu nhưng không thể tải lại lịch sử')
    }
  }

  return <div className="stack">
    <section className="content-card" aria-labelledby="daily-inspection-title">
      <div className="section-heading">
        <div><p className="eyebrow">BM-KTTBHN · Production live</p><h2 id="daily-inspection-title">Kiểm tra thiết bị hàng ngày</h2></div>
        <span className="status-pill">BACKEND WORKFLOW</span>
      </div>
      <p className="muted">V = tốt · ○ = sửa gấp · △ = cần bảo trì · X = hư hỏng, dừng máy. Kết quả X tự tạo Work Order và Downtime Event ở backend.</p>

      {loading ? <p role="status" className="muted">Đang tải danh sách thiết bị…</p> : null}
      {error ? <div className="record-card" role="alert"><b>Có lỗi</b><p>{error}</p></div> : null}
      {message ? <div className="record-card" role="status"><b>{message}</b></div> : null}

      {!loading ? <form className="stack" onSubmit={onSubmit}>
        <label>Thiết bị
          <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>
            {equipment.map((item) => <option key={item.equipmentId} value={item.equipmentId}>{item.equipmentId} · {item.equipmentName}</option>)}
          </select>
        </label>

        <label>Ca kiểm tra
          <select value={shift} onChange={(event) => setShift(event.target.value as DailyInspectionShift)}>
            <option value="MORNING">Ca sáng</option>
            <option value="AFTERNOON">Ca chiều</option>
            <option value="NIGHT">Ca đêm</option>
          </select>
        </label>

        <label>Kết quả
          <select value={overallMark} onChange={(event) => {
            const next = event.target.value as DailyInspectionMark
            setOverallMark(next)
            if (next !== 'STOP_REPAIR') setPriority('')
          }}>
            <option value="V">V · Tốt</option>
            <option value="URGENT_REPAIR">○ · Sửa gấp</option>
            <option value="MAINTENANCE_REQUIRED">△ · Cần bảo trì</option>
            <option value="STOP_REPAIR">X · Hư hỏng / dừng máy</option>
          </select>
        </label>

        <label>Ghi chú
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mô tả bất thường nếu có" />
        </label>

        <label>Bộ phận hư hỏng
          <input value={damagedParts} onChange={(event) => setDamagedParts(event.target.value)} placeholder="Để trống nếu không có" />
        </label>

        {overallMark === 'STOP_REPAIR' ? <label>Mức ưu tiên Work Order
          <select value={priority} onChange={(event) => setPriority(event.target.value as WorkOrderPriority)} required>
            <option value="">Chọn mức ưu tiên</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </label> : null}

        <button className="primary-action" type="submit" disabled={submitting || !equipment.length}>{submitting ? 'Đang lưu…' : 'Lưu kiểm tra'}</button>
      </form> : null}
    </section>

    <section className="content-card" aria-labelledby="inspection-history-title">
      <div className="section-heading"><div><p className="eyebrow">Daily_Inspection live</p><h3 id="inspection-history-title">Lịch sử kiểm tra gần nhất</h3></div></div>
      {inspections.length ? <div className="table-wrap"><table>
        <thead><tr><th>Mã</th><th>Thiết bị</th><th>Ngày / ca</th><th>Kết quả</th><th>Người kiểm</th><th>Ghi chú</th></tr></thead>
        <tbody>{inspections.slice(0, 50).map((item) => <tr key={item.inspectionId}>
          <td><b>{item.inspectionId}</b></td>
          <td>{item.equipmentId}</td>
          <td>{item.inspectionDate}<small>{item.shift || '—'}</small></td>
          <td><span className={`badge ${item.overallMark === 'STOP_REPAIR' ? 'down' : item.overallMark === 'V' ? 'running' : 'maintenance'}`}>{markLabel[item.overallMark] || item.overallMark}</span></td>
          <td>{item.inspectorId || '—'}</td>
          <td>{item.note || '—'}</td>
        </tr>)}</tbody>
      </table></div> : <p className="muted">Chưa có giao dịch kiểm tra thực tế trong production.</p>}
    </section>
  </div>
}
