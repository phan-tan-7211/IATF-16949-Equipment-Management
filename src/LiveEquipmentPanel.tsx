import { useEffect, useMemo, useState, type ClipboardEvent } from 'react'
import './Equipment.css'
import { EquipmentProfile } from './EquipmentProfile'
import { type LiveEquipment } from './data/liveEquipment'
import { checkEquipmentDeletion, deleteUnusedEquipment } from './data/equipmentDeletion'
import {
  getEquipmentPhotoPreview,
  getEquipmentPhotoPreviews,
  loadSupabaseEquipment,
  updateSupabaseEquipment,
  uploadEquipmentPhoto,
  type EquipmentEditInput,
} from './data/supabaseEquipment'

const statusLabel: Record<string, string> = {
  RUNNING: 'Hoạt động',
  DOWN: 'Sự cố',
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

function includesQuery(row: LiveEquipment, query: string) {
  if (!query) return true
  const haystack = [
    row.equipmentId,
    row.equipmentName,
    row.serialNumber,
    row.model,
    row.manufacturer,
    row.usingDepartment,
    row.managingDepartment,
    row.currentArea,
  ].join(' ').toLocaleLowerCase()
  return haystack.includes(query)
}

export function LiveEquipmentPanel() {
  const [rows, setRows] = useState<LiveEquipment[]>([])
  const [photos, setPhotos] = useState<Record<string, PhotoInfo>>({})
  const [editing, setEditing] = useState<EquipmentEditInput | null>(null)
  const [profileId, setProfileId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uploadingId, setUploadingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
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
    const loadingState = Object.fromEntries(result.map((row) => [row.equipmentId, { state: 'loading', url: '' } as PhotoInfo]))
    setPhotos(loadingState)
    try {
      const previews = await getEquipmentPhotoPreviews(result.map((row) => row.equipmentId))
      setPhotos(Object.fromEntries(result.map((row) => {
        const preview = previews[row.equipmentId]
        return [row.equipmentId, {
          state: preview?.exists ? 'yes' : 'no',
          url: preview?.signedUrl || '',
        } as PhotoInfo]
      })))
    } catch {
      setPhotos(Object.fromEntries(result.map((row) => [row.equipmentId, { state: 'error', url: '' } as PhotoInfo])))
    }
  }

  async function reloadEquipment() {
    setLoading(true)
    try {
      const result = await loadSupabaseEquipment()
      setRows(result)
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

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing])

  async function handleSave() {
    if (!editing) return
    if (!editing.equipmentId.trim() || !editing.equipmentName.trim()) {
      setMessage('Mã thiết bị và tên thiết bị không được để trống.')
      return
    }

    const saved = editing
    const nextEquipmentId = saved.equipmentId.trim()
    setSaving(true)
    setMessage('')
    try {
      await updateSupabaseEquipment(saved)

      setRows((current) => current.map((row) => row.equipmentId !== saved.oldEquipmentId
        ? row
        : {
            ...row,
            equipmentId: nextEquipmentId,
            equipmentName: saved.equipmentName.trim(),
            equipmentType: saved.equipmentType,
            model: saved.model.trim(),
            serialNumber: saved.serialNumber.trim(),
            usingDepartment: saved.department.trim(),
            status: saved.status.trim() || 'RUNNING',
            qrCode: nextEquipmentId,
            updatedAt: new Date().toISOString(),
          }))

      if (saved.oldEquipmentId !== nextEquipmentId) {
        setPhotos((current) => {
          const next = { ...current, [nextEquipmentId]: { state: 'loading', url: '' } as PhotoInfo }
          delete next[saved.oldEquipmentId]
          return next
        })
        void refreshOnePhoto(nextEquipmentId)
      }

      setMessage(`Đã lưu ${nextEquipmentId}`)
      setEditing(null)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'SAVE_FAILED')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing || deleting || saving) return
    const equipmentId = editing.oldEquipmentId.trim().toUpperCase()
    setDeleting(true)
    setMessage('')
    try {
      const check = await checkEquipmentDeletion(equipmentId)
      if (!check.exists) {
        setMessage(`${equipmentId} không còn tồn tại.`)
        setEditing(null)
        await reloadEquipment()
        return
      }
      if (!check.canDelete) {
        const detail = check.blockers.map((item) => `${item.label}: ${item.count}`).join(' · ')
        setMessage(`Không thể xóa ${equipmentId} vì đã có dữ liệu liên quan. ${detail}`)
        return
      }
      const confirmed = window.confirm(`Xóa ${equipmentId} - ${editing.equipmentName}?\n\nThiết bị chưa có dữ liệu nghiệp vụ liên quan nên có thể xóa. Hệ thống cũng sẽ xóa toàn bộ ảnh của mã này. Hành động không thể hoàn tác.`)
      if (!confirmed) return

      const result = await deleteUnusedEquipment(equipmentId)
      setRows((current) => current.filter((row) => row.equipmentId !== equipmentId))
      setPhotos((current) => {
        const next = { ...current }
        delete next[equipmentId]
        return next
      })
      setProfileId('')
      setEditing(null)
      setMessage(`Đã xóa ${equipmentId}${Number(result.removedPhotos || 0) > 0 ? ` và ${result.removedPhotos} ảnh` : ''}.`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'EQUIPMENT_DELETE_FAILED')
    } finally {
      setDeleting(false)
    }
  }

  async function confirmPhotoReplacement(equipmentId: string) {
    const current = photos[equipmentId]
    if (current?.state === 'yes') {
      return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`)
    }
    if (!current || current.state === 'loading' || current.state === 'error') {
      const exists = await refreshOnePhoto(equipmentId)
      if (exists) return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`)
    }
    return true
  }

  async function uploadAndRefresh(equipmentId: string, file: File) {
    setUploadingId(equipmentId)
    setMessage('')
    try {
      await uploadEquipmentPhoto(equipmentId, file)
      await refreshOnePhoto(equipmentId)
      setMessage(`Đã cập nhật ảnh ${equipmentId}`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'UPLOAD_FAILED')
    } finally {
      setUploadingId('')
    }
  }

  async function handlePhotoUpload(equipmentId: string, file: File | undefined) {
    if (!file) return
    if (!await confirmPhotoReplacement(equipmentId)) return
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
        if (!await confirmPhotoReplacement(equipmentId)) return
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

  async function handleEmptyPhotoCellPaste(equipmentId: string, event: ClipboardEvent<HTMLTableCellElement>) {
    const current = photos[equipmentId]
    if (current?.state !== 'no' || uploadingId) return

    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    if (!imageItem) {
      setMessage('Clipboard không có ảnh.')
      return
    }

    event.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) {
      setMessage('Không đọc được ảnh từ clipboard.')
      return
    }

    await uploadAndRefresh(equipmentId, file)
  }

  const productionCount = rows.filter((row) => row.equipmentType === 'PRODUCTION').length
  const measurementCount = rows.filter((row) => row.equipmentType === 'MEASUREMENT').length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredRows = useMemo(
    () => rows.filter((row) => (typeFilter === 'ALL' || row.equipmentType === typeFilter) && includesQuery(row, normalizedQuery)),
    [rows, typeFilter, normalizedQuery],
  )
  const profileEquipment = profileId ? rows.find((row) => row.equipmentId === profileId) || null : null

  function openEdit(row: LiveEquipment) {
    setProfileId('')
    setEditing(toDraft(row))
  }

  return <div className="equipment-page">
    <section className="equipment-summary" aria-label="Tổng quan thiết bị">
      <article><span>Tổng thiết bị</span><strong>{rows.length}</strong></article>
      <article><span>Thiết bị sản xuất</span><strong>{productionCount}</strong></article>
      <article><span>Thiết bị đo kiểm</span><strong>{measurementCount}</strong></article>
    </section>

    <section className="equipment-surface" aria-labelledby="equipment-title">
      <header className="equipment-page-header">
        <div>
          <p className="eyebrow">Equipment Master</p>
          <h2 id="equipment-title">Danh sách thiết bị</h2>
          <p>{filteredRows.length} / {rows.length} thiết bị · click mã, tên hoặc ảnh để xem hồ sơ</p>
        </div>
        <button className="equipment-refresh" type="button" onClick={() => void reloadEquipment()} disabled={loading}>Làm mới</button>
      </header>

      <div className="equipment-toolbar" role="search">
        <label className="equipment-search">
          <span className="sr-only">Tìm thiết bị</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã, tên, serial, model, bộ phận…" />
        </label>
        <label>
          <span className="sr-only">Lọc loại thiết bị</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
            <option value="ALL">Tất cả loại</option>
            <option value="PRODUCTION">Sản xuất</option>
            <option value="MEASUREMENT">Đo kiểm</option>
          </select>
        </label>
      </div>

      {message ? <div className="equipment-feedback" role="status">{message}</div> : null}
      {loading ? <div className="equipment-state">Đang tải Equipment Master…</div> : null}
      {error ? <div className="equipment-state error" role="alert">{error}</div> : null}

      {!loading && !error ? <div className="equipment-table-scroll">
        <table className="equipment-data-table">
          <caption className="sr-only">Danh sách Equipment Master</caption>
          <thead>
            <tr><th>Ảnh</th><th>Mã thiết bị</th><th>Tên thiết bị</th><th>Bộ phận</th><th>Model</th><th>Serial Number</th><th>Loại</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr>
          </thead>
          <tbody>
            {filteredRows.map((equipment) => {
              const photo = photos[equipment.equipmentId] || { state: 'loading', url: '' }
              const pasteReady = photo.state === 'no'
              return <tr key={equipment.equipmentId}>
                <td
                  className={`equipment-image-col${pasteReady ? ' paste-ready' : ''}`}
                  tabIndex={pasteReady ? 0 : undefined}
                  title={pasteReady ? 'Click ô ảnh rồi Ctrl+V để dán ảnh' : 'Mở hồ sơ thiết bị'}
                  onPaste={pasteReady ? (event) => void handleEmptyPhotoCellPaste(equipment.equipmentId, event) : undefined}
                >
                  {photo.state === 'yes' && photo.url
                    ? <button className="equipment-thumb-button" type="button" onClick={() => setProfileId(equipment.equipmentId)} aria-label={`Mở hồ sơ ${equipment.equipmentId}`}><img className="equipment-thumb" src={photo.url} alt={`Ảnh ${equipment.equipmentName}`} loading="lazy" /></button>
                    : <div className={`equipment-thumb-placeholder ${photo.state}`} aria-label="Chưa có ảnh">
                        {uploadingId === equipment.equipmentId ? 'Đang tải…' : photo.state === 'loading' ? '…' : photo.state === 'no' ? <><span>Chưa có ảnh</span><small>Click + Ctrl+V</small></> : '—'}
                      </div>}
                </td>
                <td><button className="equipment-profile-link equipment-code" type="button" onClick={() => setProfileId(equipment.equipmentId)}>{equipment.equipmentId}</button></td>
                <td><button className="equipment-profile-link equipment-name" type="button" onClick={() => setProfileId(equipment.equipmentId)}>{equipment.equipmentName}</button></td>
                <td>{equipment.usingDepartment || equipment.managingDepartment || equipment.currentArea || '—'}</td>
                <td>{equipment.model || '—'}</td>
                <td><strong>{equipment.serialNumber || '—'}</strong></td>
                <td><span className="equipment-type-badge">{equipment.equipmentType === 'MEASUREMENT' ? 'Đo kiểm' : 'Sản xuất'}</span></td>
                <td><span className={`equipment-status status-${equipment.status.toLowerCase()}`}>{statusLabel[equipment.status] || equipment.status}</span></td>
                <td className="equipment-row-actions"><button type="button" onClick={() => openEdit(equipment)}>Sửa</button></td>
              </tr>
            })}
          </tbody>
        </table>
        {filteredRows.length === 0 ? <div className="equipment-empty">Không tìm thấy thiết bị phù hợp.</div> : null}
      </div> : null}
    </section>

    {profileEquipment ? <EquipmentProfile
      equipment={profileEquipment}
      photoUrl={photos[profileEquipment.equipmentId]?.url || ''}
      onClose={() => setProfileId('')}
      onEdit={() => openEdit(profileEquipment)}
    /> : null}

    {editing ? <div className="equipment-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}>
      <aside className="equipment-drawer" role="dialog" aria-modal="true" aria-labelledby="equipment-edit-title">
        <header>
          <div><p className="eyebrow">Equipment Master</p><h2 id="equipment-edit-title">Chỉnh sửa thiết bị</h2></div>
          <button className="equipment-close" type="button" aria-label="Đóng" onClick={() => setEditing(null)}>×</button>
        </header>

        <div className="equipment-edit-photo">
          {photos[editing.oldEquipmentId]?.state === 'yes' && photos[editing.oldEquipmentId]?.url
            ? <img src={photos[editing.oldEquipmentId].url} alt={`Ảnh ${editing.equipmentName}`} />
            : <div className="equipment-edit-photo-empty">Chưa có ảnh</div>}
          <div>
            <button type="button" onClick={() => void handleClipboardUpload(editing.oldEquipmentId)} disabled={uploadingId === editing.oldEquipmentId}>{uploadingId === editing.oldEquipmentId ? 'Đang xử lý…' : 'Dán ảnh từ clipboard'}</button>
            <label className="equipment-upload-label">Chọn ảnh<input type="file" accept="image/*" disabled={uploadingId === editing.oldEquipmentId} onChange={(event) => { const file = event.currentTarget.files?.[0]; void handlePhotoUpload(editing.oldEquipmentId, file); event.currentTarget.value = '' }} /></label>
            <small>1 thiết bị = 1 ảnh · tự nén trước khi lưu</small>
          </div>
        </div>

        <div className="equipment-form-grid">
          <label><span>Mã thiết bị</span><input value={editing.equipmentId} onChange={(event) => setEditing({ ...editing, equipmentId: event.target.value })} /></label>
          <label><span>Tên thiết bị</span><input value={editing.equipmentName} onChange={(event) => setEditing({ ...editing, equipmentName: event.target.value })} /></label>
          <label><span>Loại</span><select value={editing.equipmentType} onChange={(event) => setEditing({ ...editing, equipmentType: event.target.value as EquipmentEditInput['equipmentType'] })}><option value="PRODUCTION">Sản xuất</option><option value="MEASUREMENT">Đo kiểm</option></select></label>
          <label><span>Bộ phận</span><input value={editing.department} onChange={(event) => setEditing({ ...editing, department: event.target.value })} /></label>
          <label><span>Model</span><input value={editing.model} onChange={(event) => setEditing({ ...editing, model: event.target.value })} /></label>
          <label><span>Serial Number</span><input value={editing.serialNumber} onChange={(event) => setEditing({ ...editing, serialNumber: event.target.value })} /></label>
          <label><span>Trạng thái</span><select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })}><option value="RUNNING">Hoạt động</option><option value="STOPPED">Dừng</option><option value="MAINTENANCE">Bảo trì</option><option value="DOWN">Sự cố</option><option value="DISPOSED">Thanh lý</option></select></label>
        </div>

        <footer>
          <button className="equipment-delete" type="button" onClick={() => void handleDelete()} disabled={saving || deleting}>{deleting ? 'Đang kiểm tra…' : 'Xóa thiết bị'}</button>
          <span className="equipment-footer-spacer" />
          <button className="equipment-cancel" type="button" onClick={() => setEditing(null)} disabled={deleting}>Hủy</button>
          <button className="equipment-primary" type="button" onClick={() => void handleSave()} disabled={saving || deleting}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </footer>
      </aside>
    </div> : null}
  </div>
}