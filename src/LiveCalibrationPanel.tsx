import { useEffect, useMemo, useState } from 'react'
import { createAppsScriptBridgeClient } from './data/appsScriptBridgeClient'
import { loadLiveCalibration, type CalibrationLinkState, type LiveCalibration } from './data/liveCalibration'
import { getCalibrationDueStatus } from './domain/calibration'

const linkLabel: Record<CalibrationLinkState, string> = {
  LINKED: 'Đã liên kết',
  UNLINKED: 'Chưa liên kết',
  ORPHAN: 'Mã gốc không tồn tại',
  INVALID_TYPE: 'Sai loại thiết bị',
}

export function LiveCalibrationPanel() {
  const [rows, setRows] = useState<LiveCalibration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [linkFilter, setLinkFilter] = useState<'ALL' | CalibrationLinkState>('ALL')

  useEffect(() => {
    const client = createAppsScriptBridgeClient()
    let active = true

    loadLiveCalibration(client)
      .then((result) => {
        if (!active) return
        setRows(result)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Không thể tải Calibration Master')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      client.destroy()
    }
  }, [])

  const linked = rows.filter((row) => row.linkState === 'LINKED').length
  const reconciliation = rows.length - linked
  const filteredRows = useMemo(
    () => linkFilter === 'ALL' ? rows : rows.filter((row) => row.linkState === linkFilter),
    [rows, linkFilter],
  )

  return <div className="stack">
    <section className="metric-grid" aria-label="Tổng quan Calibration Master live">
      <article><span>Tổng hồ sơ</span><strong>{rows.length}</strong><small>Calibration_Master live</small></article>
      <article><span>Đã liên kết mã gốc</span><strong>{linked}</strong><small>MEASUREMENT canonical</small></article>
      <article><span>Cần reconciliation</span><strong>{reconciliation}</strong><small>UNLINKED / ORPHAN / INVALID_TYPE</small></article>
      <article><span>Nguồn dữ liệu</span><strong>LIVE</strong><small>Apps Script → Google Sheets</small></article>
    </section>

    <section className="content-card" aria-labelledby="live-calibration-title">
      <div className="section-heading">
        <div><p className="eyebrow">CEV-BM-STCL-03 · Production data</p><h2 id="live-calibration-title">Calibration Master</h2></div>
        <div>
          <label className="sr-only" htmlFor="calibration-link-filter">Lọc trạng thái liên kết</label>
          <select id="calibration-link-filter" value={linkFilter} onChange={(event) => setLinkFilter(event.target.value as typeof linkFilter)}>
            <option value="ALL">Tất cả</option>
            <option value="LINKED">Đã liên kết</option>
            <option value="UNLINKED">Chưa liên kết</option>
            <option value="ORPHAN">Orphan</option>
            <option value="INVALID_TYPE">Sai loại</option>
          </select>
        </div>
      </div>

      {loading ? <p className="muted" role="status">Đang tải Calibration Master từ backend…</p> : null}
      {error ? <div className="record-card" role="alert"><b>Không kết nối được backend</b><p>{error}</p><small>Kiểm tra Apps Script bridge và allowed frontend origins.</small></div> : null}

      {!loading && !error ? <div className="table-wrap"><table>
        <caption className="sr-only">Danh sách thiết bị hiệu chuẩn hiện hành từ Google Sheets</caption>
        <thead><tr><th scope="col">Control No.</th><th scope="col">Thiết bị</th><th scope="col">Bộ phận</th><th scope="col">Model / Serial</th><th scope="col">Hiệu chuẩn</th><th scope="col">Hạn tiếp theo</th><th scope="col">Liên kết</th></tr></thead>
        <tbody>{filteredRows.map((item) => {
          const due = getCalibrationDueStatus(item.nextDueDate, new Date().toISOString().slice(0, 10))
          return <tr key={item.calibrationEquipmentId}>
            <td><b>{item.controlNumber || item.equipmentId || 'Chưa cấp'}</b><small>{item.calibrationEquipmentId}</small></td>
            <td>{item.instrumentName || item.localName || '—'}<small>{item.category || item.localName || '—'}</small></td>
            <td>{item.department || '—'}</td>
            <td>{item.model || '—'}<small>{item.serialNumber || '—'}</small></td>
            <td>{item.lastCalibrationDate || '—'}<small>{item.specification || item.accuracy || '—'}</small></td>
            <td>{item.nextDueDate || '—'}<small>{due}</small></td>
            <td><span className={`badge ${item.linkState === 'LINKED' ? 'running' : 'maintenance'}`}>{linkLabel[item.linkState]}</span></td>
          </tr>
        })}</tbody>
      </table></div> : null}
    </section>
  </div>
}
