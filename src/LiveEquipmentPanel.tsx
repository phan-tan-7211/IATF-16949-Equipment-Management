import { useEffect, useMemo, useState, type ClipboardEvent } from 'react'
import './Equipment.css'
import { EquipmentProfile } from './EquipmentProfile'
import { EquipmentMasterEditFields } from './EquipmentMasterEditFields'
import { EquipmentBulkEditor } from './components/EquipmentBulkEditor'
import { canEditEquipment, useAppRole } from './auth/AppRoleContext'
import { deriveEquipmentCriticality } from './data/autoRegistration'
import { bulkUpdateEquipment, type EquipmentBulkPatch } from './data/equipmentBulkEdit'
import { buildEquipmentMasterSuggestions } from './data/equipmentMasterFields'
import { type LiveEquipment } from './data/liveEquipment'
import { checkEquipmentDeletion, deleteUnusedEquipment } from './data/equipmentDeletion'
import { deleteEquipmentPhotos } from './data/equipmentPhotoDelete'
import { updateEquipmentDetails, type EquipmentMasterEditInput } from './data/equipmentMasterEdit'
import {
  getEquipmentPhotoPreview,
  getEquipmentPhotoPreviews,
  loadSupabaseEquipment,
  uploadEquipmentPhoto,
} from './data/supabaseEquipment'

const statusLabel: Record<string, string> = { RUNNING: 'Hoạt động', DOWN: 'Sự cố', MAINTENANCE: 'Bảo trì', STOPPED: 'Dừng', DISPOSED: 'Thanh lý', UNKNOWN: 'Chưa rõ' }
type PhotoInfo = { state: 'loading' | 'yes' | 'no' | 'error'; url: string }
type SortKey = 'equipmentId' | 'equipmentName' | 'department' | 'model' | 'serialNumber' | 'equipmentType' | 'status'
type SortDirection = 'asc' | 'desc'

function clipboardFileExtension(mimeType: string) { if (mimeType === 'image/png') return 'png'; if (mimeType === 'image/webp') return 'webp'; if (mimeType === 'image/gif') return 'gif'; return 'jpg' }
function booleanSelectValue(value: boolean | undefined) { return value === true ? 'YES' : value === false ? 'NO' : '' }
function parseBooleanSelect(value: string) { return value === 'YES' ? true : value === 'NO' ? false : undefined }
function equipmentDepartment(row: LiveEquipment) { return row.usingDepartment || row.managingDepartment || row.currentArea || '' }
function sortValue(row: LiveEquipment, key: SortKey) {
  if (key === 'department') return equipmentDepartment(row)
  if (key === 'status') return statusLabel[row.status] || row.status
  if (key === 'equipmentType') return row.equipmentType === 'MEASUREMENT' ? 'Đo kiểm' : 'Sản xuất'
  return String(row[key] || '')
}

function toDraft(row: LiveEquipment): EquipmentMasterEditInput {
  const criticalityFacts = row.criticalityFacts
  return {
    equipmentId: row.equipmentId, equipmentType: row.equipmentType, equipmentName: row.equipmentName,
    equipmentCategory: row.equipmentCategory || '', manufacturer: row.manufacturer || '', model: row.model || '', serialNumber: row.serialNumber || '',
    department: row.usingDepartment || '', currentArea: row.currentArea || '', currentLine: row.currentLine || '', managingDepartment: row.managingDepartment || '',
    technicalSpecification: row.technicalSpecification || '', description: row.description || '', accuracy: row.accuracy || '', origin: row.origin || '',
    manufactureDate: row.manufactureDate || '', inServiceDate: row.inServiceDate || '', warrantyUntil: row.warrantyUntil || '', warrantyContact: row.warrantyContact || '',
    note: row.note || '', relatedDocuments: row.relatedDocuments || '', status: row.status || 'RUNNING',
    controlsProductQuality: criticalityFacts?.controlsProductQuality, specialCharacteristicImpact: criticalityFacts?.specialCharacteristicImpact,
    stopsProduction: criticalityFacts?.stopsProduction, hasBackup: criticalityFacts?.hasBackup, capacityImpact: criticalityFacts?.capacityImpact,
  }
}

function includesQuery(row: LiveEquipment, query: string) {
  if (!query) return true
  return [row.equipmentId,row.equipmentName,row.serialNumber,row.model,row.manufacturer,row.usingDepartment,row.managingDepartment,row.currentArea,row.currentLine,row.equipmentCategory,row.description,row.origin].join(' ').toLocaleLowerCase().includes(query)
}

export function LiveEquipmentPanel() {
  const role = useAppRole()
  const canBulkEdit = canEditEquipment(role)
  const [rows, setRows] = useState<LiveEquipment[]>([])
  const [photos, setPhotos] = useState<Record<string, PhotoInfo>>({})
  const [editing, setEditing] = useState<EquipmentMasterEditInput | null>(null)
  const [profileId, setProfileId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uploadingId, setUploadingId] = useState('')
  const [deletingPhotoId, setDeletingPhotoId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCTION' | 'MEASUREMENT'>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('equipmentId')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const masterSuggestions = useMemo(() => buildEquipmentMasterSuggestions(rows.map((row) => ({ ...row, department: row.usingDepartment }))), [rows])

  async function refreshOnePhoto(equipmentId: string) {
    setPhotos((current) => ({ ...current, [equipmentId]: { state: 'loading', url: current[equipmentId]?.url || '' } }))
    try {
      const preview = await getEquipmentPhotoPreview(equipmentId)
      setPhotos((current) => ({ ...current, [equipmentId]: { state: preview.exists ? 'yes' : 'no', url: preview.signedUrl } }))
      return preview.exists
    } catch { setPhotos((current) => ({ ...current, [equipmentId]: { state: 'error', url: '' } })); return false }
  }

  async function refreshPhotoStates(result: LiveEquipment[]) {
    setPhotos(Object.fromEntries(result.map((row) => [row.equipmentId, { state: 'loading', url: '' } as PhotoInfo])))
    try {
      const previews = await getEquipmentPhotoPreviews(result.map((row) => row.equipmentId))
      setPhotos(Object.fromEntries(result.map((row) => { const preview = previews[row.equipmentId]; return [row.equipmentId, { state: preview?.exists ? 'yes' : 'no', url: preview?.signedUrl || '' } as PhotoInfo] })))
    } catch { setPhotos(Object.fromEntries(result.map((row) => [row.equipmentId, { state: 'error', url: '' } as PhotoInfo]))) }
  }

  async function reloadEquipment() {
    setLoading(true)
    try { const result = await loadSupabaseEquipment(); setRows(result); setError(''); void refreshPhotoStates(result) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải Equipment Master') }
    finally { setLoading(false) }
  }

  useEffect(() => { void reloadEquipment() }, [])
  useEffect(() => { if (!editing) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setEditing(null) }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [editing])
  const editCriticality = editing ? deriveEquipmentCriticality(editing) : ''

  async function handleSave() {
    if (!editing) return
    if (!editing.equipmentName.trim()) { setMessage('Tên thiết bị không được để trống.'); return }
    if (!editCriticality) { setMessage('Trả lời đủ 5 câu Criticality trước khi lưu.'); return }
    setSaving(true); setMessage('')
    try { const result = await updateEquipmentDetails(editing); setMessage(`Đã lưu ${result.equipmentId} · Cấp ${result.criticality}`); setEditing(null); await reloadEquipment() }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'SAVE_FAILED') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editing || deleting || saving) return
    const equipmentId = editing.equipmentId.trim().toUpperCase(); setDeleting(true); setMessage('')
    try {
      const check = await checkEquipmentDeletion(equipmentId)
      if (!check.exists) { setMessage(`${equipmentId} không còn tồn tại.`); setEditing(null); await reloadEquipment(); return }
      if (!check.canDelete) { setMessage(`Không thể xóa ${equipmentId} vì đã có dữ liệu liên quan. ${check.blockers.map((item) => `${item.label}: ${item.count}`).join(' · ')}`); return }
      if (!window.confirm(`Xóa ${equipmentId} - ${editing.equipmentName}?\n\nThiết bị chưa có dữ liệu nghiệp vụ liên quan nên có thể xóa. Hệ thống cũng sẽ xóa toàn bộ ảnh của mã này. Hành động không thể hoàn tác.`)) return
      const result = await deleteUnusedEquipment(equipmentId)
      setRows((current) => current.filter((row) => row.equipmentId !== equipmentId)); setPhotos((current) => { const next = { ...current }; delete next[equipmentId]; return next }); setProfileId(''); setEditing(null)
      setMessage(`Đã xóa ${equipmentId}${Number(result.removedPhotos || 0) > 0 ? ` và ${result.removedPhotos} ảnh` : ''}.`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'EQUIPMENT_DELETE_FAILED') }
    finally { setDeleting(false) }
  }

  async function confirmPhotoReplacement(equipmentId: string) {
    const current = photos[equipmentId]
    if (current?.state === 'yes') return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`)
    if (!current || current.state === 'loading' || current.state === 'error') { const exists = await refreshOnePhoto(equipmentId); if (exists) return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`) }
    return true
  }
  async function uploadAndRefresh(equipmentId: string, file: File) { setUploadingId(equipmentId); setMessage(''); try { await uploadEquipmentPhoto(equipmentId, file); await refreshOnePhoto(equipmentId); setMessage(`Đã cập nhật ảnh ${equipmentId}`) } catch (cause) { setMessage(cause instanceof Error ? `CLIPBOARD_UPLOAD_FAILED: ${cause.message}` : 'CLIPBOARD_UPLOAD_FAILED') } finally { setUploadingId('') } }
  async function handlePhotoUpload(equipmentId: string, file: File | undefined) { if (!file || !await confirmPhotoReplacement(equipmentId)) return; await uploadAndRefresh(equipmentId, file) }
  async function handlePhotoDelete(equipmentId: string) { if (!photos[equipmentId]?.url || uploadingId || deletingPhotoId) return; if (!window.confirm(`Xóa ảnh hiện tại của ${equipmentId}?\n\nChỉ ảnh sẽ bị xóa. Dữ liệu thiết bị và lịch sử không thay đổi.`)) return; setDeletingPhotoId(equipmentId); setMessage(''); try { const removed = await deleteEquipmentPhotos(equipmentId); setPhotos((current) => ({ ...current, [equipmentId]: { state: 'no', url: '' } })); setMessage(removed > 0 ? `Đã xóa ảnh ${equipmentId}.` : `${equipmentId} không có ảnh để xóa.`) } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'SUPABASE_PHOTO_DELETE_FAILED') } finally { setDeletingPhotoId('') } }
  async function handleClipboardUpload(equipmentId: string) {
    if (!navigator.clipboard?.read) { setMessage('Trình duyệt không hỗ trợ đọc ảnh từ clipboard.'); return }
    try { for (const item of await navigator.clipboard.read()) { const imageType = item.types.find((type) => type.startsWith('image/')); if (!imageType) continue; if (!await confirmPhotoReplacement(equipmentId)) return; const blob = await item.getType(imageType); await uploadAndRefresh(equipmentId, new File([blob], `clipboard.${clipboardFileExtension(imageType)}`, { type: imageType })); return } setMessage('Clipboard không có ảnh.') }
    catch (cause) { setMessage(cause instanceof Error ? `CLIPBOARD_UPLOAD_FAILED: ${cause.message}` : 'CLIPBOARD_UPLOAD_FAILED') }
  }
  async function handleEmptyPhotoCellPaste(equipmentId: string, event: ClipboardEvent<HTMLTableCellElement>) { const current = photos[equipmentId]; if (current?.state !== 'no' || uploadingId) return; const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/')); if (!imageItem) { setMessage('Clipboard không có ảnh.'); return } event.preventDefault(); const file = imageItem.getAsFile(); if (!file) { setMessage('Không đọc được ảnh từ clipboard.'); return } await uploadAndRefresh(equipmentId, file) }

  const productionCount = rows.filter((row) => row.equipmentType === 'PRODUCTION').length
  const measurementCount = rows.filter((row) => row.equipmentType === 'MEASUREMENT').length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredRows = useMemo(() => rows.filter((row) => (typeFilter === 'ALL' || row.equipmentType === typeFilter) && includesQuery(row, normalizedQuery)), [rows, typeFilter, normalizedQuery])
  const sortedRows = useMemo(() => [...filteredRows].sort((a, b) => {
    const result = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), 'vi', { numeric: true, sensitivity: 'base' })
    return sortDirection === 'asc' ? result : -result
  }), [filteredRows, sortKey, sortDirection])
  const profileEquipment = profileId ? rows.find((row) => row.equipmentId === profileId) || null : null
  const allVisibleSelected = sortedRows.length > 0 && sortedRows.every((row) => selectedIds.has(row.equipmentId))
  function openEdit(row: LiveEquipment) { setProfileId(''); setEditing(toDraft(row)) }
  function toggleSort(key: SortKey) { if (sortKey === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDirection('asc') } }
  function sortHeader(key: SortKey, label: string) {
    const active = sortKey === key
    return <th aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><button className={`equipment-sort${active ? ' active' : ''}`} type="button" onClick={() => toggleSort(key)}>{label}<span aria-hidden="true">{active ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>
  }
  function toggleSelected(equipmentId: string) {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(equipmentId)) next.delete(equipmentId); else next.add(equipmentId); return next })
  }
  function toggleAllVisible() {
    setSelectedIds((current) => { const next = new Set(current); if (allVisibleSelected) sortedRows.forEach((row) => next.delete(row.equipmentId)); else sortedRows.forEach((row) => next.add(row.equipmentId)); return next })
  }
  function exitBulkMode() { setBulkMode(false); setSelectedIds(new Set()) }
  async function applyBulkPatch(patch: EquipmentBulkPatch) {
    if (!canBulkEdit || selectedIds.size === 0) return
    if (!window.confirm(`Cập nhật ${selectedIds.size} thiết bị đã chọn?\n\nHệ thống sẽ ghi audit riêng cho từng thiết bị.`)) return
    setBulkSaving(true); setError(''); setMessage('')
    try {
      const result = await bulkUpdateEquipment([...selectedIds], patch)
      setMessage(`Đã cập nhật ${result.updatedCount} thiết bị.`)
      await reloadEquipment()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật hàng loạt.') }
    finally { setBulkSaving(false) }
  }

  return <div className="equipment-page">
    <section className="equipment-summary" aria-label="Tổng quan thiết bị"><article><span>Tổng thiết bị</span><strong>{rows.length}</strong></article><article><span>Thiết bị sản xuất</span><strong>{productionCount}</strong></article><article><span>Thiết bị đo kiểm</span><strong>{measurementCount}</strong></article></section>
    <section className="equipment-surface" aria-labelledby="equipment-title">
      <header className="equipment-page-header"><div><p className="eyebrow">Equipment Master</p><h2 id="equipment-title">Danh sách thiết bị</h2><p>{sortedRows.length} / {rows.length} thiết bị · click tiêu đề cột để sắp xếp</p></div><div className="equipment-page-actions">{canBulkEdit ? <button className={`equipment-bulk-mode-toggle${bulkMode ? ' active' : ''}`} type="button" onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}>{bulkMode ? 'Thoát sửa hàng loạt' : 'Sửa hàng loạt'}</button> : null}<button className="equipment-refresh" type="button" onClick={() => void reloadEquipment()} disabled={loading}>Làm mới</button></div></header>
      <div className="equipment-toolbar" role="search"><label className="equipment-search"><span className="sr-only">Tìm thiết bị</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã, tên, serial, model, bộ phận…" /></label><label><span className="sr-only">Lọc loại thiết bị</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}><option value="ALL">Tất cả loại</option><option value="PRODUCTION">Sản xuất</option><option value="MEASUREMENT">Đo kiểm</option></select></label></div>
      {bulkMode && canBulkEdit ? <EquipmentBulkEditor selectedCount={selectedIds.size} suggestions={masterSuggestions} saving={bulkSaving} onApply={applyBulkPatch} onExit={exitBulkMode}/> : null}
      {bulkMode && canBulkEdit ? <div className="equipment-bulk-hint"><button type="button" onClick={toggleAllVisible}>{allVisibleSelected ? 'Bỏ chọn tất cả đang hiển thị' : `Chọn tất cả ${sortedRows.length} máy đang hiển thị`}</button><span>Chỉ sửa các trường quản trị. Loại Sản xuất/Đo kiểm không đổi hàng loạt vì mã CEV-PR / CEV-ME gắn với loại thiết bị.</span></div> : null}
      {message ? <div className="equipment-feedback" role="status">{message}</div> : null}{loading ? <div className="equipment-state">Đang tải Equipment Master…</div> : null}{error ? <div className="equipment-state error" role="alert">{error}</div> : null}
      {!loading && !error ? <div className="equipment-table-scroll"><table className="equipment-data-table"><caption className="sr-only">Danh sách Equipment Master</caption><thead><tr>{bulkMode ? <th className="equipment-bulk-check"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Chọn tất cả thiết bị đang hiển thị"/></th> : null}<th>Ảnh</th>{sortHeader('equipmentId','Mã thiết bị')}{sortHeader('equipmentName','Tên thiết bị')}{sortHeader('department','Bộ phận')}{sortHeader('model','Model')}{sortHeader('serialNumber','Serial Number')}{sortHeader('equipmentType','Loại')}{sortHeader('status','Trạng thái')}<th aria-label="Thao tác" /></tr></thead><tbody>{sortedRows.map((equipment) => { const photo = photos[equipment.equipmentId] || { state: 'loading', url: '' }; const pasteReady = photo.state === 'no'; const selected = selectedIds.has(equipment.equipmentId); return <tr key={equipment.equipmentId} className={bulkMode && selected ? 'bulk-selected' : ''}>{bulkMode ? <td className="equipment-bulk-check"><input type="checkbox" checked={selected} onChange={() => toggleSelected(equipment.equipmentId)} aria-label={`Chọn ${equipment.equipmentId}`}/></td> : null}<td className={`equipment-image-col${pasteReady ? ' paste-ready' : ''}`} tabIndex={pasteReady ? 0 : undefined} title={pasteReady ? 'Click ô ảnh rồi Ctrl+V để dán ảnh' : 'Mở hồ sơ thiết bị'} onPaste={pasteReady ? (event) => void handleEmptyPhotoCellPaste(equipment.equipmentId, event) : undefined}>{photo.state === 'yes' && photo.url ? <button className="equipment-image-button" type="button" onClick={() => setProfileId(equipment.equipmentId)}><img src={photo.url} alt={equipment.equipmentName} /></button> : photo.state === 'loading' ? <span className="equipment-photo-state">…</span> : <button className="equipment-photo-empty" type="button" onClick={() => setProfileId(equipment.equipmentId)}>Chưa có ảnh</button>}</td><td><button className="equipment-link" type="button" onClick={() => setProfileId(equipment.equipmentId)}>{equipment.equipmentId}</button></td><td><button className="equipment-link equipment-name-link" type="button" onClick={() => setProfileId(equipment.equipmentId)}>{equipment.equipmentName}</button></td><td>{equipmentDepartment(equipment) || '—'}</td><td>{equipment.model || '—'}</td><td>{equipment.serialNumber || '—'}</td><td>{equipment.equipmentType === 'MEASUREMENT' ? 'Đo kiểm' : 'Sản xuất'}</td><td><span className={`equipment-status status-${equipment.status.toLowerCase()}`}>{statusLabel[equipment.status] || equipment.status}</span></td><td><button className="equipment-edit-row" type="button" onClick={() => openEdit(equipment)} disabled={bulkMode}>Sửa</button></td></tr> })}</tbody></table></div> : null}
    </section>

    {profileEquipment ? <EquipmentProfile equipment={profileEquipment} photoUrl={photos[profileEquipment.equipmentId]?.url || ''} onClose={() => setProfileId('')} onEdit={() => openEdit(profileEquipment)} /> : null}

    {editing ? <div className="equipment-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving && !deleting) setEditing(null) }}><section className="equipment-drawer" role="dialog" aria-modal="true" aria-labelledby="equipment-drawer-title">
      <header><div><p className="eyebrow">Equipment Master</p><h2 id="equipment-drawer-title">Chỉnh sửa thiết bị</h2></div><button type="button" onClick={() => setEditing(null)} disabled={saving || deleting} aria-label="Đóng">×</button></header>
      <div className="equipment-drawer-scroll">
        <div className="equipment-edit-photo">{photos[editing.equipmentId]?.url ? <img src={photos[editing.equipmentId].url} alt={`Ảnh ${editing.equipmentName}`} /> : <div className="equipment-edit-photo-empty">Chưa có ảnh</div>}<div className="equipment-edit-photo-actions"><button type="button" onClick={() => void handleClipboardUpload(editing.equipmentId)} disabled={!!uploadingId || !!deletingPhotoId}>{uploadingId === editing.equipmentId ? 'Đang tải…' : 'Dán ảnh từ clipboard'}</button><label className="equipment-edit-photo-picker">Chọn ảnh<input type="file" accept="image/*" capture="environment" disabled={!!uploadingId || !!deletingPhotoId} onChange={(event) => void handlePhotoUpload(editing.equipmentId, event.currentTarget.files?.[0])} /></label>{photos[editing.equipmentId]?.url ? <button className="equipment-edit-photo-delete" type="button" onClick={() => void handlePhotoDelete(editing.equipmentId)} disabled={!!uploadingId || !!deletingPhotoId}>{deletingPhotoId === editing.equipmentId ? 'Đang xóa ảnh…' : 'Xóa ảnh'}</button> : null}<small>1 thiết bị = 1 ảnh · tự nén trước khi lưu</small></div></div>
        <EquipmentMasterEditFields value={editing} suggestions={masterSuggestions} onChange={setEditing} />
        <fieldset className="equipment-edit-criticality"><legend>Equipment Criticality · tự tính A/B/C/D</legend><p>Trả lời 5 sự thật của quá trình. Hệ thống tự tính lại Cấp khi lưu.</p><div className="equipment-edit-criticality-grid">{[['controlsProductQuality','1. Thiết bị trực tiếp tạo / kiểm soát đặc tính chất lượng?'],['specialCharacteristicImpact','2. Liên quan Special Characteristic / Product Safety?'],['stopsProduction','3. Mất chức năng có dừng công đoạn / line?'],['hasBackup','4. Có thiết bị / phương án backup dùng ngay?'],['capacityImpact','5. Mất chức năng có rủi ro sản lượng / giao hàng?']].map(([key,label]) => <label key={key}><span>{label}</span><select value={booleanSelectValue(editing[key as keyof EquipmentMasterEditInput] as boolean | undefined)} onChange={(event) => setEditing({ ...editing, [key]: parseBooleanSelect(event.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>)}</div><div className={`equipment-edit-criticality-result${editCriticality ? ` level-${editCriticality.toLowerCase()}` : ''}`}><span>Kết quả tự động</span><strong>{editCriticality ? `Cấp ${editCriticality}` : 'Trả lời đủ 5 câu'}</strong></div></fieldset>
      </div>
      <footer><button className="equipment-delete" type="button" onClick={() => void handleDelete()} disabled={saving || deleting}>{deleting ? 'Đang xóa…' : 'Xóa thiết bị'}</button><div className="equipment-drawer-footer-actions"><button type="button" onClick={() => setEditing(null)} disabled={saving || deleting}>Hủy</button><button type="button" onClick={() => void handleSave()} disabled={saving || deleting || !editCriticality}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></footer>
    </section></div> : null}
  </div>
}
