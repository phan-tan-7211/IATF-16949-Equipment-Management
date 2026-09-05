import { useEffect, useMemo, useState } from 'react'
import type { ClipboardEvent, FormEvent } from 'react'
import './EquipmentRegistration.css'
import { useAppRole } from './auth/AppRoleContext'
import { SmartAutocomplete } from './components/SmartAutocomplete'
import { loadLiveEquipment } from './data/liveEquipment'
import { uploadEquipmentPhoto } from './data/supabaseEquipment'
import { buildEquipmentMasterSuggestions, canonicalizeMasterValue, EMPTY_MASTER_SUGGESTIONS, type EquipmentMasterSuggestionKey } from './data/equipmentMasterFields'
import {
  createEquipmentAuto,
  deriveEquipmentCriticality,
  type EquipmentRegistrationInput,
} from './data/autoRegistration'

const EMPTY: EquipmentRegistrationInput = {
  equipmentType: 'PRODUCTION', equipmentName: '', equipmentCategory: '', manufacturer: '', distributor: '', model: '', serialNumber: '', department: '', currentArea: '', currentLine: '', managingDepartment: '', managementResponsiblePrimary: '', managementResponsibleSecondary: '', technicalSpecification: '', description: '', accuracy: '', origin: '', manufactureDate: '', inServiceDate: '', warrantyUntil: '', warrantyContact: '', note: '', relatedDocuments: '', status: 'RUNNING', controlsProductQuality: undefined, specialCharacteristicImpact: undefined, stopsProduction: undefined, hasBackup: undefined, capacityImpact: undefined,
}

function booleanSelectValue(value: boolean | undefined) { return value === true ? 'YES' : value === false ? 'NO' : '' }
function parseBooleanSelect(value: string) { return value === 'YES' ? true : value === 'NO' ? false : undefined }
function clipboardFileExtension(mimeType: string) { if (mimeType === 'image/png') return 'png'; if (mimeType === 'image/webp') return 'webp'; if (mimeType === 'image/gif') return 'gif'; return 'jpg' }

function refreshEquipmentMasterAfterCreate() {
  requestAnimationFrame(() => {
    const refreshButton = document.querySelector<HTMLButtonElement>('.equipment-refresh')
    if (refreshButton && !refreshButton.disabled) refreshButton.click()
  })
}

export function LiveEquipmentRegistrationPanel() {
  const role = useAppRole()
  const canCreate = ['MAINTENANCE', 'MANAGER', 'ADMIN'].includes(role)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EquipmentRegistrationInput>(EMPTY)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState(EMPTY_MASTER_SUGGESTIONS)
  const criticality = deriveEquipmentCriticality(form)

  useEffect(() => {
    if (!open) return
    let active = true
    void loadLiveEquipment().then((rows) => {
      if (!active) return
      setSuggestions(buildEquipmentMasterSuggestions(rows.map((row) => ({ ...row, department: row.usingDepartment }))))
    }).catch(() => { if (active) setSuggestions(EMPTY_MASTER_SUGGESTIONS) })
    return () => { active = false }
  }, [open])

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const canonical = useMemo(() => {
    const next = { ...form }
    const keys: EquipmentMasterSuggestionKey[] = ['equipmentName','equipmentCategory','manufacturer','distributor','model','department','managingDepartment','managementResponsiblePrimary','managementResponsibleSecondary','currentArea','currentLine','technicalSpecification','description','accuracy','origin','warrantyContact','note','relatedDocuments']
    for (const key of keys) next[key] = canonicalizeMasterValue(String(next[key] || ''), suggestions[key])
    return next
  }, [form, suggestions])

  function resetForm() { setForm(EMPTY); setPhotoFile(null); setPhotoPreview('') }
  function textField(key: keyof EquipmentRegistrationInput, label: string, suggestionKey?: EquipmentMasterSuggestionKey, wide = false, placeholder = '', required = false) {
    return <label className={wide ? 'wide' : undefined}><span>{label}</span>{suggestionKey ? <SmartAutocomplete required={required} value={String(form[key] || '')} options={suggestions[suggestionKey]} onChange={(nextValue) => setForm({ ...form, [key]: nextValue })} onBlur={() => setForm((current) => ({ ...current, [key]: canonicalizeMasterValue(String(current[key] || ''), suggestions[suggestionKey]) }))} placeholder={placeholder} /> : <input required={required} value={String(form[key] || '')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />}</label>
  }

  function handlePhotoPaste(event: ClipboardEvent<HTMLElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    event.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) { setError('Không đọc được ảnh từ bộ nhớ tạm.'); return }
    setPhotoFile(file)
    setError('')
  }

  async function pastePhotoFromClipboard() {
    if (!navigator.clipboard?.read) { setError('Trình duyệt không hỗ trợ đọc ảnh trực tiếp từ bộ nhớ tạm. Hãy nhấn Ctrl+V vào khung ảnh.'); return }
    try {
      for (const item of await navigator.clipboard.read()) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (!imageType) continue
        const blob = await item.getType(imageType)
        setPhotoFile(new File([blob], `clipboard.${clipboardFileExtension(imageType)}`, { type: imageType }))
        setError('')
        return
      }
      setError('Bộ nhớ tạm không có ảnh.')
    } catch (cause) {
      setError(cause instanceof Error ? `Không thể đọc ảnh từ bộ nhớ tạm: ${cause.message}` : 'Không thể đọc ảnh từ bộ nhớ tạm.')
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canCreate || !canonical.equipmentName?.trim() || !canonical.managementResponsiblePrimary?.trim() || !criticality) return
    setSaving(true); setMessage(''); setError('')
    try {
      const result = await createEquipmentAuto(canonical)
      let photoNote = ''
      if (photoFile) {
        try { await uploadEquipmentPhoto(result.equipmentId, photoFile); photoNote = ' · Ảnh đã lưu.' }
        catch (cause) { photoNote = ` · Thiết bị đã tạo nhưng ảnh chưa lưu: ${cause instanceof Error ? cause.message : 'Không thể tải ảnh'}` }
      }
      setMessage(`Đã tạo ${result.equipmentId} · Cấp ${result.criticality}. Mã QR tự dùng mã thiết bị.${photoNote}`)
      resetForm(); setOpen(false)
      window.dispatchEvent(new CustomEvent('equipment-created', { detail: result }))
      refreshEquipmentMasterAfterCreate()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể đăng ký thiết bị') }
    finally { setSaving(false) }
  }

  if (!canCreate) return null
  return <section className="equipment-register-card">
    <div className="equipment-register-intro"><div><p className="eyebrow">Danh mục thiết bị · nhập chuẩn một lần</p><h2>Đăng ký thiết bị mới</h2><p>Các trường lặp lại đều gợi ý từ danh mục hiện có; có sẵn thì chọn chuẩn, chưa có thì nhập mới.</p></div><button type="button" className="equipment-register-toggle" onClick={() => setOpen((value) => !value)}>{open ? 'Đóng' : '+ Đăng ký'}</button></div>
    {message ? <div className="equipment-register-message success">{message}</div> : null}{error ? <div className="equipment-register-message error">{error}</div> : null}
    {open ? <form className="equipment-register-form" onSubmit={submit}>
      <label><span>Loại thiết bị</span><select value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value as EquipmentRegistrationInput['equipmentType'] })}><option value="PRODUCTION">Thiết bị sản xuất → CEV-PR</option><option value="MEASUREMENT">Thiết bị đo/kiểm → CEV-ME</option></select></label>
      <label><span>Trạng thái</span><select value={form.status || 'RUNNING'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="RUNNING">Hoạt động</option><option value="STOPPED">Dừng</option><option value="MAINTENANCE">Bảo trì</option><option value="DOWN">Sự cố</option><option value="DISPOSED">Thanh lý</option></select></label>
      <label><span>Tên thiết bị *</span><SmartAutocomplete autoFocus required value={form.equipmentName} options={suggestions.equipmentName} onChange={(nextValue) => setForm({ ...form, equipmentName: nextValue })} onBlur={() => setForm((current) => ({ ...current, equipmentName: canonicalizeMasterValue(current.equipmentName, suggestions.equipmentName) }))} placeholder="Chọn tên chuẩn đã có hoặc nhập tên mới" /><small className="equipment-standardize-hint">Nếu đã có “Máy nhúng bể”, chọn đúng tên đó thay vì tạo biến thể mới.</small></label>
      {textField('equipmentCategory','Nhóm thiết bị','equipmentCategory')}{textField('manufacturer','Hãng / nhà sản xuất','manufacturer')}{textField('distributor','Nhà phân phối','distributor')}{textField('model','Mẫu máy','model')}{textField('serialNumber','Số sê-ri')}
      {textField('department','Bộ phận sử dụng','department')}{textField('managingDepartment','Bộ phận quản lý','managingDepartment')}
      {textField('managementResponsiblePrimary','Người phụ trách quản lý · Chính *','managementResponsiblePrimary',false,'Nhập/chọn người chịu trách nhiệm chính',true)}
      {textField('managementResponsibleSecondary','Người phụ trách quản lý · Phụ','managementResponsibleSecondary',false,'Người thay thế / hỗ trợ')}
      {textField('currentArea','Khu vực','currentArea')}{textField('currentLine','Dây chuyền','currentLine')}
      {textField('origin','Xuất xứ','origin')}{textField('accuracy','Độ chính xác','accuracy')}
      <label><span>Ngày sản xuất</span><input type="date" value={form.manufactureDate || ''} onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })} /></label>
      <label><span>Ngày đưa vào sử dụng</span><input type="date" value={form.inServiceDate || ''} onChange={(e) => setForm({ ...form, inServiceDate: e.target.value })} /></label>
      <label><span>Bảo hành đến ngày</span><input type="date" value={form.warrantyUntil || ''} onChange={(e) => setForm({ ...form, warrantyUntil: e.target.value })} /></label>
      {textField('warrantyContact','Liên hệ bảo hành','warrantyContact')}
      {textField('technicalSpecification','Thông số kỹ thuật','technicalSpecification',false,'Chọn thông số đã dùng hoặc nhập thông số mới')}
      {textField('description','Mô tả / chức năng chính','description')}{textField('note','Ghi chú','note')}{textField('relatedDocuments','Tài liệu liên quan','relatedDocuments')}
      <label className="equipment-register-photo"><span>Ảnh thiết bị</span><div className="equipment-register-photo-box" tabIndex={0} onPaste={handlePhotoPaste} title="Có thể Ctrl+V ảnh trực tiếp vào đây">{photoPreview ? <img src={photoPreview} alt="Ảnh thiết bị chuẩn bị đăng ký" /> : <div>Chưa chọn ảnh · có thể Ctrl+V</div>}<label className="equipment-register-photo-pick">📷 Chụp / chọn ảnh<input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.currentTarget.files?.[0] || null)} /></label><button type="button" onClick={() => void pastePhotoFromClipboard()}>📋 Dán ảnh từ clipboard</button>{photoFile ? <button type="button" onClick={() => setPhotoFile(null)}>Bỏ ảnh</button> : null}</div><small>1 thiết bị = 1 ảnh · chọn file hoặc dán trực tiếp từ clipboard bằng Ctrl+V.</small></label>
      <fieldset className="equipment-criticality-auto"><legend>Mức độ quan trọng thiết bị · hệ thống tự xác định</legend><p>Tạo mới và chỉnh sửa dùng cùng quy tắc CEV-ABCD-V2.</p><div className="equipment-criticality-questions">
        <label><span>Thiết bị trực tiếp tạo / kiểm soát đặc tính chất lượng?</span><select required value={booleanSelectValue(form.controlsProductQuality)} onChange={(e) => setForm({ ...form, controlsProductQuality: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Liên quan đặc tính đặc biệt / an toàn sản phẩm?</span><select required value={booleanSelectValue(form.specialCharacteristicImpact)} onChange={(e) => setForm({ ...form, specialCharacteristicImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Mất chức năng có dừng công đoạn / dây chuyền?</span><select required value={booleanSelectValue(form.stopsProduction)} onChange={(e) => setForm({ ...form, stopsProduction: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Có thiết bị / phương án dự phòng dùng ngay?</span><select required value={booleanSelectValue(form.hasBackup)} onChange={(e) => setForm({ ...form, hasBackup: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Mất chức năng có rủi ro sản lượng / giao hàng?</span><select required value={booleanSelectValue(form.capacityImpact)} onChange={(e) => setForm({ ...form, capacityImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
      </div></fieldset>
      <div className="equipment-register-outcomes"><div className={`equipment-criticality-result${criticality ? ` level-${criticality.toLowerCase()}` : ''}`}><span>Mức hệ thống tính</span><strong>{criticality ? `Cấp ${criticality}` : 'Chưa đủ dữ kiện'}</strong></div><div className="equipment-register-result"><span>Mã thiết bị + mã QR tự sinh sau khi lưu</span><strong>{form.equipmentType === 'PRODUCTION' ? 'CEV-PR-…' : 'CEV-ME-…'}</strong><small>Không nhập mã bằng tay.</small></div></div>
      <footer><button type="button" onClick={() => { setOpen(false); resetForm() }}>Hủy</button><button className="equipment-register-save" disabled={saving || !form.equipmentName.trim() || !form.managementResponsiblePrimary?.trim() || !criticality}>{saving ? 'Đang tạo…' : 'Tạo thiết bị & sinh mã'}</button></footer>
    </form> : null}
  </section>
}