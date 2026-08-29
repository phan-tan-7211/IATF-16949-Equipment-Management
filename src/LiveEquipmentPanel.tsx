import { useEffect, useMemo, useState } from 'react'
import { type LiveEquipment } from './data/liveEquipment'
import {
  getEquipmentPhotoPreview,
  loadSupabaseEquipment,
  updateSupabaseEquipment,
  uploadEquipmentPhoto,
  type EquipmentEditInput,
} from './data/supabaseEquipment'

const statusLabel: Record<string, string> = {
  RUNNING: 'Hoạt động',
  DOWN: 'DOWN',
  MAINTENANCE: 'Bảo trì',
  STOPPED: 'Dừng',
  DISPOSED: 'Thanh lý',
  UNKNOWN: 'Chưa rõ',
}

type PhotoInfo = {
  state: 'loading' | 'yes' | 'no' | 'error'
  url: string
}

function clipboardFileExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'jpg'
}

function toDraft(row: LiveEquipment): EquipmentEditInput {
  return {
    oldEquipmentId: row.equipmentId,
    equipmentId: row.equipmentId,
    equipmentType: row.equipmentType,
    equipmentName: row.equipmentName,
    department: row.usingDepartment || row.managingDepartment || row.currentArea || '',
    model: row.model,
    serialNumber: row.serialNumber,
    status: row.status || 'RUNNING',
  }
}

export function LiveEquipmentPanel() {
  const [rows, setRows] = useState<LiveEquipment[]>([])
  const [drafts, setDrafts] = useState<Record<string, EquipmentEditInput>>({})
  const [photos, setPhotos] = useState<Record<string, PhotoInfo>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uploadingId, setUploadingId] = useState('')
  const [savingId, setSavingId] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCTION' | 'MEASUREMENT'>('ALL')

  async function refreshOnePhoto(equipmentId: string) {
    setPhotos((current) => ({ ...current, [equipmentId]: { state: 'loading', url: current[equipmentId]?.url || '' } }))
    try {
      const preview = await getEquipmentPhotoPreview(equipmentId)
      setPhotos((current) => ({
        ...current,
        [equipmentId]: { state: preview.exists ? 'yes' : 'no', url: preview.signedUrl },
      }))
      return preview.exists
    } catch {
      setPhotos((current) => ({ ...current, [equipmentId]: { state: 'error', url: '' } }))
      return false
    }
  }

  async function refreshPhotoStates(result: LiveEquipment[]) {
    setPhotos(Object.fromEntries(result.map((row) => [row.equipmentId, { state: 'loading', url: '' } as PhotoInfo])))
    await Promise.all(result.map((row) => refreshOnePhoto(row.equipmentId)))
  }

  async function reloadEquipment() {
    setLoading(true)
    try {
      const result = await loadSupabaseEquipment()
      setRows(result)
      setDrafts(Object.fromEntries(result.map((row) => [row.equipmentId, toDraft(row)])))
      setError('')
      void refreshPhotoStates(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải Equipment Master')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadEquipment()
  }, [])

  function patchDraft(oldEquipmentId: string, patch: Partial<EquipmentEditInput>) {
    setDrafts((current) => ({
      ...current,
      [oldEquipmentId]: { ...current[oldEquipmentId], ...patch },
    }))
  }

  async function handleSave(oldEquipmentId: string) {
    const draft = drafts[oldEquipmentId]
    if (!draft) return
    if (!draft.equipmentId.trim()) {
      setMessage('Mã thiết bị không được để trống.')
      return
    }
    setSavingId(oldEquipmentId)
    setMessage('')
    try {
      await updateSupabaseEquipment(draft)
      setMessage(`Đã lưu ${draft.equipmentId}`)
      await reloadEquipment()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'SAVE_FAILED')
    } finally {
      setSavingId('')
    }
  }

  async function confirmPhotoReplacement(equipmentId: string) {
    let photo = photos[equipmentId]
    if (!photo || photo.state === 'loading' || photo.state === 'error') {
      await refreshOnePhoto(equipmentId)
      const preview = await getEquipmentPhotoPreview(equipmentId).catch(() => null)
      if (!preview?.exists) return true
    } else if (photo.state !== 'yes') {
      return true
    }
    return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`)
  }

  async function uploadAndRefresh(equipmentId: string, file: File) {
    setUploadingId(equipmentId)
    setMessage('')
    try {
      await uploadEquipmentPhoto(equipmentId, file)
      await refreshOnePhoto(equipmentId)
      setMessage(`Đã lưu ảnh cho ${equipmentId}`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'UPLOAD_FAILED')
    } finally {
      setUploadingId('')
    }
  }

  async function handlePhotoUpload(equipmentId: string, file: File | undefined) {
    if (!file) return
    if (!await confirmPhotoReplacement(equipmentId)) {
      setMessage('Đã hủy thay ảnh.')
      return
    }
    await uploadAndRefresh(equipmentId, file)
  }

  async function handleClipboardUpload(equipmentId: string) {
    if (!navigator.clipboard?.read) {
      setMessage('Trình duyệt không hỗ trợ đọc ảnh từ clipboard.')
      return
    }

    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (!imageType) continue
        if (!await confirmPhotoReplacement(equipmentId)) {
          setMessage('Đã hủy thay ảnh.')
          return
        }
        const blob = await item.getType(imageType)
        const extension = clipboardFileExtension(imageType)
        const file = new File([blob], `clipboard.${extension}`, { type: imageType })
        await uploadAndRefresh(equipmentId, file)
        return
      }
      setMessage('Clipboard không có ảnh.')
    } catch (cause) {
      setMessage(cause instanceof Error ? `CLIPBOARD_UPLOAD_FAILED: ${cause.message}` : 'CLIPBOARD_UPLOAD_FAILED')
    }
  }

  const productionCount = rows.filter((row) => row.equipmentType === 'PRODUCTION').length
  const measurementCount = rows.filter((row) => row.equipmentType === 'MEASUREMENT').length
  const filteredRows = useMemo(
    () => typeFilter === 'ALL' ? rows : rows.filter((row) => row.equipmentType === typeFilter),
    [rows, typeFilter],
  )

  return <div className="stack equipment-master-page">
    <section className="metric-grid equipment-metrics" aria-label="Tổng quan Equipment Master live">
      <article><span>Tổng thiết bị</span><strong>{rows.length}</strong></article>
      <article><span>Sản xuất</span><strong>{productionCount}</strong></article>
      <article><span>Đo kiểm</span><strong>{measurementCount}</strong></article>
      <article><span>Nguồn</span><strong>LIVE</strong><small>Supabase</small></article>
    </section>

    <section className="content-card equipment-card" aria-labelledby="live-equipment-title">
      <div className="section-heading equipment-heading">
        <div>
          <p className="eyebrow">BM-TBSX-01 · 02</p>
          <h2 id="live-equipment-title">Equipment Master</h2>
        </div>
        <select id="equipment-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
          <option value="ALL">Tất cả</option>
          <option value="PRODUCTION">Sản xuất</option>
          <option value="MEASUREMENT">Đo kiểm</option>
        </select>
      </div>

      {loading ? <p className="muted" role="status">Đang tải…</p> : null}
      {error ? <div className="record-card" role="alert"><b>Không kết nối được Supabase</b><p>{error}</p></div> : null}
      {message ? <div className="equipment-toast" role="status">{message}</div> : null}

      {!loading && !error ? <div className="table-wrap equipment-table-wrap">
        <table className="equipment-table">
          <caption className="sr-only">Danh sách Equipment Master từ Supabase</caption>
          <thead><tr><th>Mã</th><th>Thiết bị</th><th>Loại</th><th>Bộ phận</th><th>Model</th><th>Serial Number</th><th>Trạng thái</th><th>Ảnh</th><th></th></tr></thead>
          <tbody>{filteredRows.map((equipment) => {
            const draft = drafts[equipment.equipmentId] || toDraft(equipment)
            const uploadTargetId = draft.equipmentId.trim() || equipment.equipmentId
            const photo = photos[equipment.equipmentId] || { state: 'loading', url: '' }
            return <tr key={equipment.equipmentId}>
              <td><input className="equipment-id-input" value={draft.equipmentId} onChange={(event) => patchDraft(equipment.equipmentId, { equipmentId: event.target.value })} /></td>
              <td><input value={draft.equipmentName} onChange={(event) => patchDraft(equipment.equipmentId, { equipmentName: event.target.value })} /></td>
              <td><select value={draft.equipmentType} onChange={(event) => patchDraft(equipment.equipmentId, { equipmentType: event.target.value as EquipmentEditInput['equipmentType'] })}><option value="PRODUCTION">PRODUCTION</option><option value="MEASUREMENT">MEASUREMENT</option></select></td>
              <td><input value={draft.department} onChange={(event) => patchDraft(equipment.equipmentId, { department: event.target.value })} /></td>
              <td><input value={draft.model} onChange={(event) => patchDraft(equipment.equipmentId, { model: event.target.value })} /></td>
              <td><input value={draft.serialNumber} onChange={(event) => patchDraft(equipment.equipmentId, { serialNumber: event.target.value })} /></td>
              <td><select value={draft.status} onChange={(event) => patchDraft(equipment.equipmentId, { status: event.target.value })}><option value="RUNNING">{statusLabel.RUNNING}</option><option value="STOPPED">{statusLabel.STOPPED}</option><option value="MAINTENANCE">{statusLabel.MAINTENANCE}</option><option value="DOWN">{statusLabel.DOWN}</option><option value="DISPOSED">{statusLabel.DISPOSED}</option></select></td>
              <td className="equipment-photo-cell">
                <div className="equipment-photo-box">
                  {photo.state === 'yes' && photo.url
                    ? <img src={photo.url} alt={`Ảnh ${equipment.equipmentId}`} loading="lazy" />
                    : <div className={`equipment-photo-empty ${photo.state}`}>{photo.state === 'loading' ? '…' : photo.state === 'error' ? '!' : 'Chưa có ảnh'}</div>}
                  <div className="equipment-photo-actions">
                    <button type="button" disabled={uploadingId === uploadTargetId} onClick={() => void handleClipboardUpload(uploadTargetId)}>{uploadingId === uploadTargetId ? 'Đang tải…' : photo.state === 'yes' ? 'Thay ảnh' : 'Dán ảnh'}</button>
                    <label className="equipment-file-button">
                      Chọn
                      <input type="file" accept="image/*" disabled={uploadingId === uploadTargetId} onChange={(event) => { const file = event.currentTarget.files?.[0]; void handlePhotoUpload(uploadTargetId, file); event.currentTarget.value = '' }} />
                    </label>
                  </div>
                </div>
              </td>
              <td><button className="equipment-save-button" type="button" disabled={savingId === equipment.equipmentId} onClick={() => void handleSave(equipment.equipmentId)}>{savingId === equipment.equipmentId ? '…' : 'Lưu'}</button></td>
            </tr>
          })}</tbody>
        </table>
      </div> : null}
    </section>
  </div>
}
