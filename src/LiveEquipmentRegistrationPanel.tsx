import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './EquipmentRegistration.css'
import { useAppRole } from './auth/AppRoleContext'
import { loadLiveEquipment } from './data/liveEquipment'
import { uploadEquipmentPhoto } from './data/supabaseEquipment'
import {
  createEquipmentAuto,
  deriveEquipmentCriticality,
  type EquipmentRegistrationInput,
} from './data/autoRegistration'

const EMPTY: EquipmentRegistrationInput = {
  equipmentType: 'PRODUCTION',
  equipmentName: '',
  equipmentCategory: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  department: '',
  currentArea: '',
  currentLine: '',
  managingDepartment: '',
  technicalSpecification: '',
  status: 'RUNNING',
  controlsProductQuality: undefined,
  specialCharacteristicImpact: undefined,
  stopsProduction: undefined,
  hasBackup: undefined,
  capacityImpact: undefined,
}

type RegistrationSuggestions = {
  equipmentNames: string[]
  departments: string[]
  lines: string[]
}

const EMPTY_SUGGESTIONS: RegistrationSuggestions = {
  equipmentNames: [],
  departments: [],
  lines: [],
}

function booleanSelectValue(value: boolean | undefined) {
  if (value === true) return 'YES'
  if (value === false) return 'NO'
  return ''
}

function parseBooleanSelect(value: string) {
  if (value === 'YES') return true
  if (value === 'NO') return false
  return undefined
}

function normalizeComparable(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN')
}

function canonicalize(value: string | undefined, options: string[]) {
  const clean = (value || '').trim().replace(/\s+/g, ' ')
  if (!clean) return ''
  const normalized = normalizeComparable(clean)
  return options.find((option) => normalizeComparable(option) === normalized) || clean
}

function uniqueCanonical(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const clean = value.trim().replace(/\s+/g, ' ')
    if (!clean) continue
    const key = normalizeComparable(clean)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(clean)
  }
  return result.sort((a, b) => a.localeCompare(b, 'vi'))
}

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
  const [suggestions, setSuggestions] = useState<RegistrationSuggestions>(EMPTY_SUGGESTIONS)
  const criticality = deriveEquipmentCriticality(form)
  const criticalityComplete = Boolean(criticality)

  useEffect(() => {
    if (!open) return
    let active = true
    void loadLiveEquipment()
      .then((rows) => {
        if (!active) return
        setSuggestions({
          equipmentNames: uniqueCanonical(rows.map((row) => row.equipmentName)),
          departments: uniqueCanonical(rows.flatMap((row) => [row.usingDepartment, row.managingDepartment]).filter(Boolean)),
          lines: uniqueCanonical(rows.flatMap((row) => [row.currentLine, row.currentArea]).filter(Boolean)),
        })
      })
      .catch(() => {
        if (active) setSuggestions(EMPTY_SUGGESTIONS)
      })
    return () => { active = false }
  }, [open])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const standardizedPreview = useMemo(() => ({
    equipmentName: canonicalize(form.equipmentName, suggestions.equipmentNames),
    department: canonicalize(form.department, suggestions.departments),
    currentArea: canonicalize(form.currentArea, suggestions.lines),
    currentLine: canonicalize(form.currentLine, suggestions.lines),
    managingDepartment: canonicalize(form.managingDepartment, suggestions.departments),
  }), [form.equipmentName, form.department, form.currentArea, form.currentLine, form.managingDepartment, suggestions])

  function resetForm() {
    setForm(EMPTY)
    setPhotoFile(null)
    setPhotoPreview('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canCreate || !form.equipmentName.trim() || !criticalityComplete) return
    setSaving(true); setMessage(''); setError('')
    try {
      const standardizedInput: EquipmentRegistrationInput = {
        ...form,
        equipmentName: standardizedPreview.equipmentName,
        department: standardizedPreview.department,
        currentArea: standardizedPreview.currentArea,
        currentLine: standardizedPreview.currentLine,
        managingDepartment: standardizedPreview.managingDepartment,
      }
      const result = await createEquipmentAuto(standardizedInput)
      let photoNote = ''
      if (photoFile) {
        try {
          await uploadEquipmentPhoto(result.equipmentId, photoFile)
          photoNote = ' · Ảnh đã lưu.'
        } catch (cause) {
          photoNote = ` · Thiết bị đã tạo nhưng ảnh chưa lưu: ${cause instanceof Error ? cause.message : 'UPLOAD_FAILED'}`
        }
      }
      setMessage(`Đã tạo ${result.equipmentId} · Cấp ${result.criticality}. QR tự dùng mã này.${photoNote}`)
      resetForm()
      setOpen(false)
      window.dispatchEvent(new CustomEvent('equipment-created', { detail: result }))
      refreshEquipmentMasterAfterCreate()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng ký thiết bị')
    } finally { setSaving(false) }
  }

  if (!canCreate) return null
  return <section className="equipment-register-card">
    <div className="equipment-register-intro">
      <div><p className="eyebrow">Equipment Master · mã + cấp độ tự sinh</p><h2>Đăng ký thiết bị mới</h2><p>Nhập thông tin gốc một lần. Hệ thống tự cấp <b>CEV-PR/ME</b>, QR và tự xác định mức độ quan trọng <b>A/B/C/D</b>.</p></div>
      <button type="button" className="equipment-register-toggle" onClick={() => setOpen((value) => !value)}>{open ? 'Đóng' : '+ Đăng ký'}</button>
    </div>
    {message ? <div className="equipment-register-message success">{message}</div> : null}
    {error ? <div className="equipment-register-message error">{error}</div> : null}
    {open ? <form className="equipment-register-form" onSubmit={submit}>
      <label><span>Loại thiết bị</span><select value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value as EquipmentRegistrationInput['equipmentType'] })}><option value="PRODUCTION">Thiết bị sản xuất → CEV-PR</option><option value="MEASUREMENT">Thiết bị đo/kiểm → CEV-ME</option></select></label>
      <label><span>Trạng thái</span><select value={form.status || 'RUNNING'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="RUNNING">Hoạt động</option><option value="STOPPED">Dừng</option><option value="MAINTENANCE">Bảo trì</option><option value="DOWN">Sự cố</option><option value="DISPOSED">Thanh lý</option></select></label>

      <label className="wide"><span>Tên thiết bị *</span><input autoFocus list="equipment-name-suggestions" value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} onBlur={() => setForm((current) => ({ ...current, equipmentName: canonicalize(current.equipmentName, suggestions.equipmentNames) }))} placeholder="Gõ để chọn tên đã dùng hoặc nhập tên mới" required /><datalist id="equipment-name-suggestions">{suggestions.equipmentNames.map((value) => <option key={value} value={value} />)}</datalist><small className="equipment-standardize-hint">Ưu tiên tên đã tồn tại để các máy cùng loại dùng cùng tên chuẩn.</small></label>
      <label><span>Nhóm / Category</span><input value={form.equipmentCategory || ''} onChange={(e) => setForm({ ...form, equipmentCategory: e.target.value })} placeholder="Ví dụ: Winding / Press / Measuring" /></label>
      <label><span>Maker</span><input value={form.manufacturer || ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></label>
      <label><span>Model</span><input value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
      <label><span>Serial Number</span><input value={form.serialNumber || ''} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>

      <label><span>Bộ phận sử dụng</span><input list="equipment-department-suggestions" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} onBlur={() => setForm((current) => ({ ...current, department: canonicalize(current.department, suggestions.departments) }))} placeholder="Coil / Press / WPC…" /><datalist id="equipment-department-suggestions">{suggestions.departments.map((value) => <option key={value} value={value} />)}</datalist></label>
      <label><span>Bộ phận quản lý</span><input list="equipment-department-suggestions" value={form.managingDepartment || ''} onChange={(e) => setForm({ ...form, managingDepartment: e.target.value })} onBlur={() => setForm((current) => ({ ...current, managingDepartment: canonicalize(current.managingDepartment, suggestions.departments) }))} /></label>
      <label><span>Khu vực</span><input list="equipment-line-suggestions" value={form.currentArea || ''} onChange={(e) => setForm({ ...form, currentArea: e.target.value })} onBlur={() => setForm((current) => ({ ...current, currentArea: canonicalize(current.currentArea, suggestions.lines) }))} /></label>
      <label><span>Line</span><input list="equipment-line-suggestions" value={form.currentLine || ''} onChange={(e) => setForm({ ...form, currentLine: e.target.value })} onBlur={() => setForm((current) => ({ ...current, currentLine: canonicalize(current.currentLine, suggestions.lines) }))} /><datalist id="equipment-line-suggestions">{suggestions.lines.map((value) => <option key={value} value={value} />)}</datalist></label>
      <label className="wide"><span>Thông số kỹ thuật</span><textarea rows={3} value={form.technicalSpecification || ''} onChange={(e) => setForm({ ...form, technicalSpecification: e.target.value })} placeholder="Thông số chính cần lưu trong Equipment Master" /></label>

      <label className="wide equipment-register-photo"><span>Ảnh thiết bị</span><div className="equipment-register-photo-box">{photoPreview ? <img src={photoPreview} alt="Ảnh thiết bị chuẩn bị đăng ký" /> : <div>Chưa chọn ảnh</div>}<label className="equipment-register-photo-pick">📷 Chụp / chọn ảnh<input type="file" accept="image/*" capture="environment" onChange={(event) => setPhotoFile(event.currentTarget.files?.[0] || null)} /></label>{photoFile ? <button type="button" onClick={() => setPhotoFile(null)}>Bỏ ảnh</button> : null}</div><small>1 thiết bị = 1 ảnh. Ảnh sẽ tự nén trước khi lưu.</small></label>

      <fieldset className="equipment-criticality-auto">
        <legend>Mức độ quan trọng thiết bị · hệ thống tự xác định</legend>
        <p>Trả lời 5 dữ kiện về vai trò thiết bị. Tạo và Sửa đều dùng cùng quy tắc CEV-ABCD-V2.</p>
        <div className="equipment-criticality-questions">
          <label><span>Thiết bị có trực tiếp tạo hoặc kiểm soát đặc tính chất lượng sản phẩm?</span><select required value={booleanSelectValue(form.controlsProductQuality)} onChange={(e) => setForm({ ...form, controlsProductQuality: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
          <label><span>Thiết bị có liên quan Special Characteristic / Product Safety?</span><select required value={booleanSelectValue(form.specialCharacteristicImpact)} onChange={(e) => setForm({ ...form, specialCharacteristicImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
          <label><span>Nếu thiết bị mất chức năng, công đoạn hoặc line có bị dừng?</span><select required value={booleanSelectValue(form.stopsProduction)} onChange={(e) => setForm({ ...form, stopsProduction: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
          <label><span>Có thiết bị hoặc phương án backup có thể dùng ngay?</span><select required value={booleanSelectValue(form.hasBackup)} onChange={(e) => setForm({ ...form, hasBackup: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
          <label><span>Nếu thiết bị mất chức năng, có nguy cơ không đạt sản lượng / kế hoạch giao hàng?</span><select required value={booleanSelectValue(form.capacityImpact)} onChange={(e) => setForm({ ...form, capacityImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
        </div>
        <div className={`equipment-criticality-result${criticality ? ` level-${criticality.toLowerCase()}` : ''}`}>
          <span>Mức hệ thống tính</span>
          <strong>{criticality ? `Cấp ${criticality}` : 'Chưa đủ dữ kiện'}</strong>
          <small>{criticality ? 'Backend sẽ tính lại cùng quy tắc trước khi lưu.' : 'Trả lời đủ 5 câu để xác định cấp độ.'}</small>
        </div>
      </fieldset>

      <div className="equipment-register-result"><span>Mã + QR sẽ tự sinh sau khi lưu</span><strong>{form.equipmentType === 'PRODUCTION' ? 'CEV-PR-…' : 'CEV-ME-…'}</strong><small>Không nhập mã bằng tay.</small></div>
      <footer><button type="button" onClick={() => { setOpen(false); resetForm() }}>Hủy</button><button className="equipment-register-save" disabled={saving || !form.equipmentName.trim() || !criticalityComplete}>{saving ? 'Đang tạo…' : 'Tạo thiết bị & sinh mã'}</button></footer>
    </form> : null}
  </section>
}
