import { useEffect, useMemo, useState } from 'react'
import { createAppsScriptBridgeClient } from './data/appsScriptBridgeClient'
import { loadLiveEquipment, type LiveEquipment } from './data/liveEquipment'

const statusLabel: Record<string, string> = {
  RUNNING: 'Hoạt động',
  DOWN: 'DOWN',
  MAINTENANCE: 'Bảo trì',
  STOPPED: 'Dừng',
  DISPOSED: 'Thanh lý',
}

export function LiveEquipmentPanel() {
  const [rows, setRows] = useState<LiveEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCTION' | 'MEASUREMENT'>('ALL')

  useEffect(() => {
    const client = createAppsScriptBridgeClient()
    let active = true

    loadLiveEquipment(client)
      .then((result) => {
        if (!active) return
        setRows(result)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Không thể tải Equipment Master')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      client.destroy()
    }
  }, [])

  const productionCount = rows.filter((row) => row.equipmentType === 'PRODUCTION').length
  const measurementCount = rows.filter((row) => row.equipmentType === 'MEASUREMENT').length
  const filteredRows = useMemo(
    () => typeFilter === 'ALL' ? rows : rows.filter((row) => row.equipmentType === typeFilter),
    [rows, typeFilter],
  )

  return <div className="stack">
    <section className="metric-grid" aria-label="Tổng quan Equipment Master live">
      <article><span>Tổng thiết bị</span><strong>{rows.length}</strong><small>Equipment_Master live</small></article>
      <article><span>Thiết bị sản xuất</span><strong>{productionCount}</strong><small>PRODUCTION</small></article>
      <article><span>Thiết bị đo kiểm</span><strong>{measurementCount}</strong><small>MEASUREMENT</small></article>
      <article><span>Nguồn dữ liệu</span><strong>LIVE</strong><small>Apps Script → Google Sheets</small></article>
    </section>

    <section className="content-card" aria-labelledby="live-equipment-title">
      <div className="section-heading">
        <div><p className="eyebrow">BM-TBSX-01 · 02 · Production data</p><h2 id="live-equipment-title">Equipment Master</h2></div>
        <div>
          <label className="sr-only" htmlFor="equipment-type-filter">Lọc loại thiết bị</label>
          <select id="equipment-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
            <option value="ALL">Tất cả</option>
            <option value="PRODUCTION">Thiết bị sản xuất</option>
            <option value="MEASUREMENT">Thiết bị đo kiểm</option>
          </select>
        </div>
      </div>

      {loading ? <p className="muted" role="status">Đang tải Equipment Master từ backend…</p> : null}
      {error ? <div className="record-card" role="alert"><b>Không kết nối được backend</b><p>{error}</p><small>Kiểm tra VITE_APPS_SCRIPT_WEB_APP_URL và ALLOWED_PARENT_ORIGINS_JSON.</small></div> : null}

      {!loading && !error ? <div className="table-wrap">
        <table>
          <caption className="sr-only">Danh sách Equipment Master production từ Google Sheets</caption>
          <thead><tr><th scope="col">Mã</th><th scope="col">Thiết bị</th><th scope="col">Loại</th><th scope="col">Bộ phận</th><th scope="col">Model / Serial</th><th scope="col">Trạng thái</th></tr></thead>
          <tbody>{filteredRows.map((equipment) => <tr key={equipment.equipmentId}>
            <td><b>{equipment.equipmentId}</b><small>QR: {equipment.qrCode}</small></td>
            <td>{equipment.equipmentName}<small>{equipment.equipmentCategory || '—'}</small></td>
            <td><span className="status-pill">{equipment.equipmentType}</span></td>
            <td>{equipment.usingDepartment || equipment.managingDepartment || equipment.currentArea || '—'}<small>{equipment.currentLine || '—'}</small></td>
            <td>{equipment.model || '—'}<small>{equipment.serialNumber || '—'}</small></td>
            <td><span className={`badge ${equipment.status.toLowerCase()}`}>{statusLabel[equipment.status] || equipment.status}</span></td>
          </tr>)}</tbody>
        </table>
      </div> : null}
    </section>
  </div>
}
