import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './EquipmentRegistration.css'
import { useAppRole } from './auth/AppRoleContext'
import { loadLiveEquipment } from './data/liveEquipment'
import { uploadEquipmentPhoto } from './data/supabaseEquipment'
import { buildEquipmentMasterSuggestions, canonicalizeMasterValue, EMPTY_MASTER_SUGGESTIONS, type EquipmentMasterSuggestionKey } from './data/equipmentMasterFields'
import {
  createEquipmentAuto,
  deriveEquipmentCriticality,
  type EquipmentRegistrationInput,
} from './data/autoRegistration'

const EMPTY: EquipmentRegistrationInput = {
  equipmentType: 'PRODUCTION', equipmentName: '', equipmentCategory: '', manufacturer: '', model: '', serialNumber: '', department: '', currentArea: '', currentLine: '', managingDepartment: '', technicalSpecification: '', description: '', accuracy: '', origin: '', manufactureDate: '', inServiceDate: '', warrantyUntil: '', warrantyContact: '', note: '', relatedDocuments: '', status: 'RUNNING', controlsProductQuality: undefined, specialCharacteristicImpact: undefined, stopsProduction: undefined, hasBackup: undefined, capacityImpact: undefined,
}

function booleanSelectValue(value: boolean | undefined) { return value === true ? 'YES' : value === false ? 'NO' : '' }
function parseBooleanSelect(value: string) { return value === 'YES' ? true : value === 'NO' ? false : undefined }

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
    const keys: EquipmentMasterSuggestionKey[] = ['equipmentName','equipmentCategory','manufacturer','model','department','managingDepartment','currentArea','currentLine','technicalSpecification','description','accuracy','origin','warrantyContact','note','relatedDocuments']
    for (const key of keys) next[key] = canonicalizeMasterValue(String(next[key] || ''), suggestions[key])
    return next
  }, [form, suggestions])

  function resetForm() { setForm(EMPTY); setPhotoFile(null); setPhotoPreview('') }
  function textField(key: keyof EquipmentRegistrationInput, label: string, suggestionKey?: EquipmentMasterSuggestionKey, wide = false, placeholder = '') {
    const listId = suggestionKey ? `master-${suggestionKey}-suggestions` : undefined
    return <label className={wide ? 'wide' : undefined}><span>{label}</span><input list={listId} value={String(form[key] || '')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} onBlur={() => suggestionKey && setForm((current) => ({ ...current, [key]: canonicalizeMasterValue(String(current[key] || ''), suggestions[suggestionKey]) }))} placeholder={placeholder} />{suggestionKey ? <datalist id={listId}>{suggestions[suggestionKey].map((value) => <option key={value} value={value} />)}</datalist> : null}</label>
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canCreate || !canonical.equipmentName?.trim() || !criticality) return
    setSaving(true); setMessage(''); setError('')
    try {
      const result = await createEquipmentAuto(canonical)
      let photoNote = ''
      if (photoFile) {
        try { await uploadEquipmentPhoto(result.equipmentId, photoFile); photoNote = ' · Ảnh đã lưu.' }
        catch (cause) { photoNote = ` · Thiết bị đã tạo nhưng ảnh chưa lưu: ${cause instanceof Error ? cause.message : 'UPLOAD_FAILED'}` }
      }
      setMessage(`Đã tạo ${result.equipmentId} · Cấp ${result.criticality}. QR tự dùng mã này.${photoNote}`)
      resetForm(); setOpen(false)
      window.dispatchEvent(new CustomEvent('equipment-created', { detail: result }))
      refreshEquipmentMasterAfterCreate()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể đăng ký thiết bị') }
    finally { setSaving(false) }
  }

  if (!canCreate) return null
  return <section className="equipment-register-card">
    <div className="equipment-register-intro"><div><p className="eyebrow">Equipment Master · nhập chuẩn một lần</p><h2>Đăng ký thiết bị mới</h2><p>Các trường lặp lại đều gợi ý từ Master hiện có; có sẵn thì chọn chuẩn, chưa có thì nhập mới.</p></div><button type="button" className="equipment-register-toggle" onClick={() => setOpen((value) => !value)}>{open ? 'Đóng' : '+ Đăng ký'}</button></div>
    {message ? <div className="equipment-register-message success">{message}</div> : null}{error ? <div className="equipment-register-message error">{error}</div> : null}
    {open ? <form className="equipment-register-form" onSubmit={submit}>
      <label><span>Loại thiết bị</span><select value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value as EquipmentRegistrationInput['equipmentType'] })}><option value="PRODUCTION">Thiết bị sản xuất → CEV-PR</option><option value="MEASUREMENT">Thiết bị đo/kiểm → CEV-ME</option></select></label>
      <label><span>Trạng thái</span><select value={form.status || 'RUNNING'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="RUNNING">Hoạt động</option><option value="STOPPED">Dừng</option><option value="MAINTENANCE">Bảo trì</option><option value="DOWN">Sự cố</option><option value="DISPOSED">Thanh lý</option></select></label>
      <label className="wide"><span>Tên thiết bị *</span><input autoFocus list="master-equipmentName-suggestions" value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} onBlur={() => setForm((current) => ({ ...current, equipmentName: canonicalizeMasterValue(current.equipmentName, suggestions.equipmentName) }))} required placeholder="Chọn tên chuẩn đã có hoặc nhập tên mới" /><datalist id="master-equipmentName-suggestions">{suggestions.equipmentName.map((value) => <option key={value} value={value} />)}</datalist><small className="equipment-standardize-hint">Nếu đã có “Máy nhúng bể”, chọn đúng tên đó thay vì tạo biến thể mới.</small></label>
      {textField('equipmentCategory','Nhóm / Category','equipmentCategory')}{textField('manufacturer','Maker / Hãng','manufacturer')}{textField('model','Model','model')}{textField('serialNumber','Serial Number')}
      {textField('department','Bộ phận sử dụng','department')}{textField('managingDepartment','Bộ phận quản lý','managingDepartment')}{textField('currentArea','Khu vực','currentArea')}{textField('currentLine','Line','currentLine')}
      {textField('origin','Xuất xứ','origin')}{textField('accuracy','Độ chính xác','accuracy')}
      <label><span>Ngày sản xuất</span><input type="date" value={form.manufactureDate || ''} onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })} /></label>
      <label><span>Ngày đưa vào sử dụng</span><input type="date" value={form.inServiceDate || ''} onChange={(e) => setForm({ ...form, inServiceDate: e.target.value })} /></label>
      <label><span>Bảo hành đến ngày</span><input type="date" value={form.warrantyUntil || ''} onChange={(e) => setForm({ ...form, warrantyUntil: e.target.value })} /></label>
      {textField('warrantyContact','Liên hệ bảo hành','warrantyContact')}
      {textField('technicalSpecification','Thông số kỹ thuật','technicalSpecification',true,'Chọn thông số đã dùng hoặc nhập thông số mới')}
      {textField('description','Mô tả / chức năng chính','description',true)}{textField('note','Ghi chú','note',true)}{textField('relatedDocuments','Tài liệu liên quan','relatedDocuments',true)}
      <label className="wide equipment-register-photo"><span>Ảnh thiết bị</span><div className="equipment-register-photo-box">{photoPreview ? <img src={photoPreview} alt="Ảnh thiết bị chuẩn bị đăng ký" /> : <div>Chưa chọn ảnh</div>}<label className="equipment-register-photo-pick">📷 Chụp / chọn ảnh<input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.currentTarget.files?.[0] || null)} /></label>{photoFile ? <button type="button" onClick={() => setPhotoFile(null)}>Bỏ ảnh</button> : null}</div><small>1 thiết bị = 1 ảnh. Ảnh tự scale, không crop.</small></label>
      <fieldset className="equipment-criticality-auto"><legend>Mức độ quan trọng thiết bị · hệ thống tự xác định</legend><p>Tạo và Sửa dùng cùng quy tắc CEV-ABCD-V2.</p><div className="equipment-criticality-questions">
        <label><span>Thiết bị trực tiếp tạo / kiểm soát đặc tính chất lượng?</span><select required value={booleanSelectValue(form.controlsProductQuality)} onChange={(e) => setForm({ ...form, controlsProductQuality: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Liên quan Special Characteristic / Product Safety?</span><select required value={booleanSelectValue(form.specialCharacteristicImpact)} onChange={(e) => setForm({ ...form, specialCharacteristicImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Mất chức năng có dừng công đoạn / line?</span><select required value={booleanSelectValue(form.stopsProduction)} onChange={(e) => setForm({ ...form, stopsProduction: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Có thiết bị / phương án backup dùng ngay?</span><select required value={booleanSelectValue(form.hasBackup)} onChange={(e) => setForm({ ...form, hasBackup: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        <label><span>Mất chức năng có rủi ro sản lượng / giao hàng?</span><select required value={booleanSelectValue(form.capacityImpact)} onChange={(e) => setForm({ ...form, capacityImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
      </div><div className={`equipment-criticality-result${criticality ? ` level-${criticality.toLowerCase()}` : ''}`}><span>Mức hệ thống tính</span><strong>{criticality ? `Cấp ${criticality}` : 'Chưa đủ dữ kiện'}</strong></div></fieldset>
      <div className="equipment-register-result"><span>Mã + QR tự sinh sau khi lưu</span><strong>{form.equipmentType === 'PRODUCTION' ? 'CEV-PR-…' : 'CEV-ME-…'}</strong><small>Không nhập mã bằng tay.</small></div>
      <footer><button type="button" onClick={() => { setOpen(false); resetForm() }}>Hủy</button><button className="equipment-register-save" disabled={saving || !form.equipmentName.trim() || !criticality}>{saving ? 'Đang tạo…' : 'Tạo thiết bị & sinh mã'}</button></footer>
    </form> : null}
  </section>
}
