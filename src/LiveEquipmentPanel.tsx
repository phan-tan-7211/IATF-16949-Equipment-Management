import { useEffect, useMemo, useState } from 'react'
import { type LiveEquipment } from './data/liveEquipment'
import { loadSupabaseEquipment, uploadEquipmentPhoto } from './data/supabaseEquipment'

const statusLabel: Record<string, string> = {
  RUNNING: 'Hoạt động',
  DOWN: 'DOWN',
  MAINTENANCE: 'Bảo trì',
  STOPPED: 'Dừng',
  DISPOSED: 'Thanh lý',
  UNKNOWN: 'Chưa rõ',
}

function clipboardFileExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'jpg'
}

export function LiveEquipmentPanel() {
  const [rows, setRows] = useState<LiveEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uploadingId, setUploadingId] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCTION' | 'MEASUREMENT'>('ALL')

  useEffect(() => {
    let active = true

    loadSupabaseEquipment()
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
    }
  }, [])

  async function handlePhotoUpload(equipmentId: string, file: File | undefined) {
    if (!file) return
    setUploadingId(equipmentId)
    setMessage('')
    try {
      const path = await uploadEquipmentPhoto(equipmentId, file)
      setMessage(`UPLOAD_OK: ${path}`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'UPLOAD_FAILED')
    } finally {
      setUploadingId('')
    }
  }

  async function handleClipboardUpload(equipmentId: string) {
    if (!navigator.clipboard?.read) {
      setMessage('CLIPBOARD_IMAGE_NOT_SUPPORTED')
      return
    }

    setUploadingId(equipmentId)
    setMessage('')
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (!imageType) continue
        const blob = await item.getType(imageType)
        const extension = clipboardFileExtension(imageType)
        const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType })
        const path = await uploadEquipmentPhoto(equipmentId, file)
        setMessage(`CLIPBOARD_UPLOAD_OK: ${path}`)
        return
      }
      setMessage('CLIPBOARD_NO_IMAGE: Clipboard không có ảnh.')
    } catch (cause) {
      setMessage(cause instanceof Error ? `CLIPBOARD_UPLOAD_FAILED: ${cause.message}` : 'CLIPBOARD_UPLOAD_FAILED')
    } finally {
      setUploadingId('')
    }
  }

  const productionCount = rows.filter((row) => row.equipmentType === 'PRODUCTION').length
  const measurementCount = rows.filter((row) => row.equipmentType === 'MEASUREMENT').length
  const filteredRows = useMemo(
    () => typeFilter === 'ALL' ? rows : rows.filter((row) => row.equipmentType === typeFilter),
    [rows, typeFilter],
  )

  return <div className="stack">
    <section className="metric-grid" aria-label="Tổng quan Equipment Master live">
      <article><span>Tổng thiết bị</span><strong>{rows.length}</strong><small>equipment_master live</small></article>
      <article><span>Thiết bị sản xuất</span><strong>{productionCount}</strong><small>PRODUCTION</small></article>
      <article><span>Thiết bị đo kiểm</span><strong>{measurementCount}</strong><small>MEASUREMENT</small></article>
      <article><span>Nguồn dữ liệu</span><strong>LIVE</strong><small>Supabase PostgreSQL + Storage</small></article>
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

      {loading ? <p className="muted" role="status">Đang tải Equipment Master từ Supabase…</p> : null}
      {error ? <div className="record-card" role="alert"><b>Không kết nối được Supabase</b><p>{error}</p><small>Kiểm tra session đăng nhập và RLS của equipment_master.</small></div> : null}
      {message ? <div className="record-card" role="status"><p>{message}</p></div> : null}

      {!loading && !error ? <div className="table-wrap">
        <table>
          <caption className="sr-only">Danh sách Equipment Master từ Supabase</caption>
          <thead><tr><th scope="col">Mã</th><th scope="col">Thiết bị</th><th scope="col">Loại</th><th scope="col">Bộ phận</th><th scope="col">Model</th><th scope="col">Serial Number</th><th scope="col">Trạng thái</th><th scope="col">Ảnh thiết bị</th></tr></thead>
          <tbody>{filteredRows.map((equipment) => <tr key={equipment.equipmentId}>
            <td><b>{equipment.equipmentId}</b><small>QR: {equipment.qrCode}</small></td>
            <td>{equipment.equipmentName}<small>{equipment.equipmentCategory || '—'}</small></td>
            <td><span className="status-pill">{equipment.equipmentType}</span></td>
            <td>{equipment.usingDepartment || equipment.managingDepartment || equipment.currentArea || '—'}<small>{equipment.currentLine || '—'}</small></td>
            <td>{equipment.model || '—'}</td>
            <td><b>{equipment.serialNumber || '—'}</b></td>
            <td><span className={`badge ${equipment.status.toLowerCase()}`}>{statusLabel[equipment.status] || equipment.status}</span></td>
            <td>
              <div className="stack-sm">
                <label>
                  <span className="sr-only">Tải ảnh cho {equipment.equipmentId}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingId === equipment.equipmentId}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      void handlePhotoUpload(equipment.equipmentId, file)
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={uploadingId === equipment.equipmentId}
                  onClick={() => void handleClipboardUpload(equipment.equipmentId)}
                >
                  Dán ảnh từ clipboard
                </button>
                <small>{uploadingId === equipment.equipmentId ? 'Đang tải…' : 'Ctrl+C ảnh → bấm Dán · tối đa 5 MB'}</small>
              </div>
            </td>
          </tr>)}</tbody>
        </table>
      </div> : null}
    </section>
  </div>
}
