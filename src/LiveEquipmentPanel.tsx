import { useEffect, useMemo, useState } from 'react'
import { type LiveEquipment } from './data/liveEquipment'
import {
  hasEquipmentPhoto,
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

type PhotoState = 'loading' | 'yes' | 'no' | 'error'

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
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoState>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uploadingId, setUploadingId] = useState('')
  const [savingId, setSavingId] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCTION' | 'MEASUREMENT'>('ALL')

  async function refreshPhotoStates(result: LiveEquipment[]) {
    setPhotoStates(Object.fromEntries(result.map((row) => [row.equipmentId, 'loading' as PhotoState])))
    await Promise.all(result.map(async (row) => {
      try {
        const exists = await hasEquipmentPhoto(row.equipmentId)
        setPhotoStates((current) => ({ ...current, [row.equipmentId]: exists ? 'yes' : 'no' }))
      } catch {
        setPhotoStates((current) => ({ ...current, [row.equipmentId]: 'error' }))
      }
    }))
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
      setMessage(`SAVE_OK: ${draft.equipmentId}`)
      await reloadEquipment()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'SAVE_FAILED')
    } finally {
      setSavingId('')
    }
  }

  async function confirmPhotoReplacement(equipmentId: string) {
    let state = photoStates[equipmentId]
    if (!state || state === 'loading' || state === 'error') {
      try {
        const exists = await hasEquipmentPhoto(equipmentId)
        state = exists ? 'yes' : 'no'
        setPhotoStates((current) => ({ ...current, [equipmentId]: state as PhotoState }))
      } catch {
        state = 'error'
      }
    }
    if (state !== 'yes') return true
    return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Bạn có chắc muốn thay thế ảnh hiện tại?`)
  }

  async function handlePhotoUpload(equipmentId: string, file: File | undefined) {
    if (!file) return
    if (!await confirmPhotoReplacement(equipmentId)) {
      setMessage('Đã hủy thay ảnh.')
      return
    }
    setUploadingId(equipmentId)
    setMessage('')
    try {
      const path = await uploadEquipmentPhoto(equipmentId, file)
      setPhotoStates((current) => ({ ...current, [equipmentId]: 'yes' }))
      setMessage(`Ảnh đã lưu: ${path}`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'UPLOAD_FAILED')
    } finally {
      setUploadingId('')
    }
  }

  async function handleClipboardUpload(equipmentId: string) {
    if (!navigator.clipboard?.read) {
      setMessage('Trình duyệt không hỗ trợ đọc ảnh từ clipboard.')
      return
    }

    setUploadingId(equipmentId)
    setMessage('')
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
        const path = await uploadEquipmentPhoto(equipmentId, file)
        setPhotoStates((current) => ({ ...current, [equipmentId]: 'yes' }))
        setMessage(`Ảnh đã lưu: ${path}`)
        return
      }
      setMessage('Clipboard không có ảnh.')
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
        <div>
          <p className="eyebrow">BM-TBSX-01 · 02 · Production data</p>
          <h2 id="live-equipment-title">Equipment Master</h2>
          <small>1 thiết bị = 1 ảnh. Ảnh mới sẽ thay ảnh cũ sau khi xác nhận.</small>
        </div>
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
          <thead><tr><th scope="col">Mã</th><th scope="col">Thiết bị</th><th scope="col">Loại</th><th scope="col">Bộ phận</th><th scope="col">Model</th><th scope="col">Serial Number</th><th scope="col">Trạng thái</th><th scope="col">Ảnh thiết bị</th><th scope="col">Lưu</th></tr></thead>
          <tbody>{filteredRows.map((equipment) => {
            const draft = drafts[equipment.equipmentId] || toDraft(equipment)
            const uploadTargetId = draft.equipmentId.trim() || equipment.equipmentId
            const photoState = photoStates[equipment.equipmentId] || 'loading'
            return <tr key={equipment.equipmentId}>
              <td>
                <input value={draft.equipmentId} onChange={(event) => patchDraft(equipment.equipmentId, { equipmentId: event.target.value })} />
                <small>QR tự theo mã</small>
              </td>
              <td><input value={draft.equipmentName} onChange={(event) => patchDraft(equipment.equipmentId, { equipmentName: event.target.value })} /></td>
              <td>
                <select value={draft.equipmentType} onChange={(event) => patchDraft(equipment.equipmentId, { equipmentType: event.target.value as EquipmentEditInput['equipmentType'] })}>
                  <option value="PRODUCTION">PRODUCTION</option>
                  <option value="MEASUREMENT">MEASUREMENT</option>
                </select>
              </td>
              <td><input value={draft.department} onChange={(event) => patchDraft(equipment.equipmentId, { department: event.target.value })} /></td>
              <td><input value={draft.model} onChange={(event) => patchDraft(equipment.equipmentId, { model: event.target.value })} /></td>
              <td><input value={draft.serialNumber} onChange={(event) => patchDraft(equipment.equipmentId, { serialNumber: event.target.value })} /></td>
              <td>
                <select value={draft.status} onChange={(event) => patchDraft(equipment.equipmentId, { status: event.target.value })}>
                  <option value="RUNNING">{statusLabel.RUNNING}</option>
                  <option value="STOPPED">{statusLabel.STOPPED}</option>
                  <option value="MAINTENANCE">{statusLabel.MAINTENANCE}</option>
                  <option value="DOWN">{statusLabel.DOWN}</option>
                  <option value="DISPOSED">{statusLabel.DISPOSED}</option>
                </select>
              </td>
              <td>
                <div className="stack-sm">
                  <strong>{photoState === 'yes' ? '✓ Đã có ảnh' : photoState === 'no' ? '— Chưa có ảnh' : photoState === 'error' ? '? Không kiểm tra được' : 'Đang kiểm tra ảnh…'}</strong>
                  <label>
                    <span className="sr-only">Tải ảnh cho {uploadTargetId}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingId === uploadTargetId}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0]
                        void handlePhotoUpload(uploadTargetId, file)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                  <button type="button" disabled={uploadingId === uploadTargetId} onClick={() => void handleClipboardUpload(uploadTargetId)}>
                    {photoState === 'yes' ? 'Dán ảnh mới / Thay thế' : 'Dán ảnh từ clipboard'}
                  </button>
                  <small>{uploadingId === uploadTargetId ? 'Đang nén và tải…' : 'Ảnh được nén tự động trước khi lưu'}</small>
                </div>
              </td>
              <td>
                <button type="button" disabled={savingId === equipment.equipmentId} onClick={() => void handleSave(equipment.equipmentId)}>
                  {savingId === equipment.equipmentId ? 'Đang lưu…' : 'Lưu'}
                </button>
              </td>
            </tr>
          })}</tbody>
        </table>
      </div> : null}
    </section>
  </div>
}
