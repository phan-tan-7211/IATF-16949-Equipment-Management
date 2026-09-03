import { useEffect, useMemo, useRef, useState } from 'react'
import './EquipmentProfile.css'
import { useDialogScrollLock } from './useDialogScrollLock'
import type { LiveEquipment } from './data/liveEquipment'
import { getEquipmentPhotoPreview, uploadEquipmentPhoto, loadEquipmentHistory, type EquipmentHistory } from './data/supabaseEquipment'

import { canManageEquipmentPhoto, useAppRole } from './auth/AppRoleContext'

type Props = {
  equipment: LiveEquipment
  photoUrl: string
  onClose: () => void
  onEdit: () => void
}

type Tab = 'overview' | 'calibration' | 'maintenance' | 'inspection' | 'downtime' | 'movement' | 'audit'

const EMPTY_HISTORY: EquipmentHistory = {
  calibration: [],
  maintenance: [],
  inspections: [],
  downtime: [],
  movements: [],
  audit: [],
}

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function dateText(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('vi-VN')
}

function dateTimeText(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN')
}

export function EquipmentProfile({ equipment, photoUrl, onClose, onEdit }: Props) {
  useDialogScrollLock()
  const [tab, setTab] = useState<Tab>('overview')
  const [history, setHistory] = useState<EquipmentHistory>(EMPTY_HISTORY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canUploadPhoto = canManageEquipmentPhoto(useAppRole())
  const [photoChoices, setPhotoChoices] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [uploadedPhoto, setUploadedPhoto] = useState({ id: '', url: '' })
  const photoUploadLock = useRef(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const displayedPhoto = uploadedPhoto.id === equipment.equipmentId ? uploadedPhoto.url : photoUrl

  async function addPhoto(file?: File) {
    if (!file || !canUploadPhoto || photoUploadLock.current) return
    photoUploadLock.current = true
    setPhotoBusy(true)
    setPhotoError('')
    try {
      await uploadEquipmentPhoto(equipment.equipmentId, file)
      const photo = await getEquipmentPhotoPreview(equipment.equipmentId)
      if (!photo.signedUrl) throw new Error('Chưa tải được ảnh vừa lưu. Vui lòng mở lại hồ sơ.')
      setUploadedPhoto({ id: equipment.equipmentId, url: photo.signedUrl })
      setPhotoChoices(false)
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : 'Không tải được ảnh. Vui lòng thử lại.')
    } finally {
      photoUploadLock.current = false
      setPhotoBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void loadEquipmentHistory(equipment.equipmentId)
      .then((result) => { if (active) setHistory(result) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử thiết bị') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [equipment.equipmentId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const counts = useMemo(() => ({
    calibration: history.calibration.length,
    maintenance: history.maintenance.length,
    inspection: history.inspections.length,
    downtime: history.downtime.length,
    movement: history.movements.length,
    audit: history.audit.length,
  }), [history])

  return <div
    className="equipment-profile-layer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="equipment-profile-title"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}
  >
    <article className="equipment-profile">
      <header className="equipment-profile-header">
        <div>
          <button className="equipment-profile-back" type="button" onClick={onClose}>← Danh sách thiết bị</button>
          <p className="eyebrow">Hồ sơ thiết bị</p>
          <h2 id="equipment-profile-title">{equipment.equipmentId} · {equipment.equipmentName}</h2>
        </div>
        <div className="equipment-profile-header-actions">
          <button type="button" onClick={onEdit}>Sửa thiết bị</button>
          <button className="equipment-profile-close" type="button" onClick={onClose} aria-label="Đóng hồ sơ">×</button>
        </div>
      </header>

      <section className="equipment-profile-hero">
        <div className="equipment-profile-image-wrap">
          {displayedPhoto
            ? <img src={displayedPhoto} alt={`Ảnh lớn ${equipment.equipmentName}`} />
            : <div className="equipment-profile-no-image">
              {canUploadPhoto ? <>
                <button className="equipment-profile-add-photo" type="button" disabled={photoBusy}
                  aria-expanded={photoChoices} onClick={() => setPhotoChoices(true)}>
                  <strong>{photoBusy ? 'Đang lưu ảnh…' : 'Chưa có ảnh thiết bị'}</strong>
                  {!photoBusy && <span>Chạm để chụp hoặc tải ảnh lên</span>}
                </button>
                {photoChoices && !photoBusy && <div className="equipment-profile-photo-actions">
                  <button type="button" onClick={() => cameraInput.current?.click()}>Chụp ảnh</button>
                  <button type="button" onClick={() => fileInput.current?.click()}>Tải ảnh lên</button>
                </div>}
                <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden
                  aria-label="Chụp ảnh thiết bị" onChange={event => { void addPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
                <input ref={fileInput} type="file" accept="image/*" hidden
                  aria-label="Tải ảnh thiết bị" onChange={event => { void addPhoto(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
                {photoError && <div className="equipment-profile-photo-error" role="alert">{photoError}</div>}
              </> : 'Chưa có ảnh thiết bị'}
            </div>}
        </div>
        <div className="equipment-profile-identity">
          <span className={`equipment-profile-status status-${equipment.status.toLowerCase()}`}>{equipment.status}</span>
          <dl>
            <div><dt>Serial Number</dt><dd>{text(equipment.serialNumber)}</dd></div>
            <div><dt>Model</dt><dd>{text(equipment.model)}</dd></div>
            <div><dt>Hãng</dt><dd>{text(equipment.manufacturer)}</dd></div>
            <div><dt>Bộ phận</dt><dd>{text(equipment.usingDepartment || equipment.managingDepartment || equipment.currentArea)}</dd></div>
            <div><dt>Loại</dt><dd>{equipment.equipmentType === 'MEASUREMENT' ? 'Thiết bị đo kiểm' : 'Thiết bị sản xuất'}</dd></div>
            <div><dt>QR / Equipment ID</dt><dd>{equipment.qrCode}</dd></div>
          </dl>
        </div>
      </section>

      <nav className="equipment-profile-tabs" aria-label="Nội dung hồ sơ thiết bị">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Tổng quan</button>
        <button className={tab === 'calibration' ? 'active' : ''} onClick={() => setTab('calibration')}>Hiệu chuẩn <span>{counts.calibration}</span></button>
        <button className={tab === 'maintenance' ? 'active' : ''} onClick={() => setTab('maintenance')}>Bảo trì <span>{counts.maintenance}</span></button>
        <button className={tab === 'inspection' ? 'active' : ''} onClick={() => setTab('inspection')}>Kiểm tra <span>{counts.inspection}</span></button>
        <button className={tab === 'downtime' ? 'active' : ''} onClick={() => setTab('downtime')}>Sự cố <span>{counts.downtime}</span></button>
        <button className={tab === 'movement' ? 'active' : ''} onClick={() => setTab('movement')}>Di chuyển <span>{counts.movement}</span></button>
        <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit <span>{counts.audit}</span></button>
      </nav>

      <section className="equipment-profile-content">
        {loading ? <div className="equipment-profile-state">Đang tải lịch sử…</div> : null}
        {error ? <div className="equipment-profile-state error">{error}</div> : null}

        {!loading && !error && tab === 'overview' ? <div className="equipment-profile-overview-grid">
          <article><span>Hiệu chuẩn</span><strong>{counts.calibration}</strong><small>bản ghi</small></article>
          <article><span>Bảo trì</span><strong>{counts.maintenance}</strong><small>work order</small></article>
          <article><span>Kiểm tra</span><strong>{counts.inspection}</strong><small>bản ghi</small></article>
          <article><span>Sự cố / downtime</span><strong>{counts.downtime}</strong><small>sự kiện</small></article>
          <article><span>Di chuyển</span><strong>{counts.movement}</strong><small>lần</small></article>
          <article><span>Cập nhật gần nhất</span><strong className="small-value">{dateTimeText(equipment.updatedAt)}</strong></article>
        </div> : null}

        {!loading && !error && tab === 'calibration' ? <HistoryTable
          empty="Chưa có lịch sử hiệu chuẩn."
          rows={history.calibration}
          columns={[
            ['Ngày hiệu chuẩn', (row) => dateText(row.calibration_date)],
            ['Hạn tiếp theo', (row) => dateText(row.next_due_date)],
            ['Kết quả', (row) => text(row.result)],
            ['Người thực hiện', (row) => text(row.actor_email)],
          ]}
        /> : null}

        {!loading && !error && tab === 'maintenance' ? <HistoryTable
          empty="Chưa có work order bảo trì."
          rows={history.maintenance}
          columns={[
            ['Work order', (row) => text(row.work_order_id)],
            ['Trạng thái', (row) => text(row.status)],
            ['Ưu tiên', (row) => text(row.priority)],
            ['Lý do', (row) => text(row.reason)],
            ['Ngày tạo', (row) => dateTimeText(row.created_at)],
          ]}
        /> : null}

        {!loading && !error && tab === 'inspection' ? <HistoryTable
          empty="Chưa có lịch sử kiểm tra."
          rows={history.inspections}
          columns={[
            ['Ngày', (row) => dateText(row.inspection_date)],
            ['Ca', (row) => text(row.shift)],
            ['Khu vực', (row) => text(row.area)],
            ['Kết quả', (row) => text(row.overall_mark)],
            ['Ghi chú', (row) => text(row.note)],
          ]}
        /> : null}

        {!loading && !error && tab === 'downtime' ? <HistoryTable
          empty="Chưa có sự kiện downtime."
          rows={history.downtime}
          columns={[
            ['Bắt đầu', (row) => dateTimeText(row.started_at)],
            ['Kết thúc', (row) => dateTimeText(row.ended_at)],
            ['Work order', (row) => text(row.work_order_id)],
          ]}
        /> : null}

        {!loading && !error && tab === 'movement' ? <HistoryTable
          empty="Chưa có lịch sử di chuyển."
          rows={history.movements}
          columns={[
            ['Thời gian', (row) => dateTimeText(row.created_at)],
            ['Từ', (row) => text(row.from_location)],
            ['Đến', (row) => text(row.to_location)],
            ['Người thực hiện', (row) => text(row.actor_email)],
          ]}
        /> : null}

        {!loading && !error && tab === 'audit' ? <HistoryTable
          empty="Chưa có audit log."
          rows={history.audit}
          columns={[
            ['Thời gian', (row) => dateTimeText(row.created_at)],
            ['Hành động', (row) => text(row.action)],
            ['Đối tượng', (row) => `${text(row.entity_type)} / ${text(row.entity_id)}`],
            ['Người thực hiện', (row) => text(row.actor_email)],
          ]}
        /> : null}
      </section>
    </article>
  </div>
}

function HistoryTable({ rows, columns, empty }: {
  rows: Array<Record<string, unknown>>
  columns: Array<[string, (row: Record<string, unknown>) => string]>
  empty: string
}) {
  if (rows.length === 0) return <div className="equipment-profile-empty">{empty}</div>
  return <div className="equipment-profile-table-wrap"><table className="equipment-profile-table">
    <thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={String(row.id || row.created_at || index)}>{columns.map(([label, render]) => <td key={label}>{render(row)}</td>)}</tr>)}</tbody>
  </table></div>
}
