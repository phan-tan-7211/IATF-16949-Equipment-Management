import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './EquipmentRegistration.css'
import { useAppRole } from './auth/AppRoleContext'
import { loadLiveEquipment } from './data/liveEquipment'
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

  const standardizedPreview = useMemo(() => ({
    equipmentName: canonicalize(form.equipmentName, suggestions.equipmentNames),
    department: canonicalize(form.department, suggestions.departments),
    currentLine: canonicalize(form.currentLine, suggestions.lines),
  }), [form.equipmentName, form.department, form.currentLine, suggestions])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canCreate || !form.equipmentName.trim() || !criticalityComplete) return
    setSaving(true); setMessage(''); setError('')
    try {
      const standardizedInput: EquipmentRegistrationInput = {
        ...form,
        equipmentName: standardizedPreview.equipmentName,
        department: standardizedPreview.department,
        currentLine: standardizedPreview.currentLine,
      }
      const result = await createEquipmentAuto(standardizedInput)
      setMessage(`Đã tạo ${result.equipmentId} · Cấp ${result.criticality}. QR cũng tự dùng mã này.`)
      setForm(EMPTY)
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
      <div><p className="eyebrow">Flow đăng ký · mã + cấp độ tự sinh</p><h2>Đăng ký thiết bị mới</h2><p>Chỉ trả lời thông tin thực tế. Hệ thống tự cấp <b>CEV-PR/ME</b>, QR và tự xác định mức độ quan trọng <b>A/B/C/D</b>.</p></div>
      <button type="button" className="equipment-register-toggle" onClick={() => setOpen((value) => !value)}>{open ? 'Đóng' : '+ Đăng ký'}</button>
    </div>
    {message ? <div className="equipment-register-message success">{message}</div> : null}
    {error ? <div className="equipment-register-message error">{error}</div> : null}
    {open ? <form className="equipment-register-form" onSubmit={submit}>
      <label><span>1. Đây là loại nào?</span><select value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value as EquipmentRegistrationInput['equipmentType'] })}><option value="PRODUCTION">Thiết bị sản xuất → CEV-PR</option><option value="MEASUREMENT">Thiết bị đo/kiểm → CEV-ME</option></select></label>
      <label className="wide"><span>2. Tên thiết bị *</span><input autoFocus list="equipment-name-suggestions" value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} onBlur={() => setForm((current) => ({ ...current, equipmentName: canonicalize(current.equipmentName, suggestions.equipmentNames) }))} placeholder="Gõ để chọn tên đã dùng hoặc nhập tên mới" required /><datalist id="equipment-name-suggestions">{suggestions.equipmentNames.map((value) => <option key={value} value={value} />)}</datalist><small className="equipment-standardize-hint">Ưu tiên chọn tên đã tồn tại để các máy cùng loại dùng cùng tên chuẩn.</small></label>
      <label><span>3. Bộ phận sử dụng</span><input list="equipment-department-suggestions" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} onBlur={() => setForm((current) => ({ ...current, department: canonicalize(current.department, suggestions.departments) }))} placeholder="Gõ để chọn Coil / Press / WPC…" /><datalist id="equipment-department-suggestions">{suggestions.departments.map((value) => <option key={value} value={value} />)}</datalist></label>
      <label><span>Khu vực / line</span><input list="equipment-line-suggestions" value={form.currentLine || ''} onChange={(e) => setForm({ ...form, currentLine: e.target.value })} onBlur={() => setForm((current) => ({ ...current, currentLine: canonicalize(current.currentLine, suggestions.lines) }))} placeholder="Gõ để chọn line/khu vực đã dùng" /><datalist id="equipment-line-suggestions">{suggestions.lines.map((value) => <option key={value} value={value} />)}</datalist></label>

      <fieldset className="equipment-criticality-auto">
        <legend>4. Mức độ quan trọng thiết bị · hệ thống tự xác định</legend>
        <p>Không đánh giá một lần hỏng nặng hay nhẹ. Chỉ xác định vai trò của thiết bị đối với chất lượng, đặc tính đặc biệt, sản lượng và khả năng thay thế.</p>
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
          <small>{criticality ? 'Backend sẽ tính lại cùng quy tắc CEV-ABCD-V2 trước khi lưu.' : 'Trả lời đủ 5 câu để xác định mức độ quan trọng thiết bị.'}</small>
        </div>
      </fieldset>

      <label><span>Model</span><input value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
      <label><span>Serial Number</span><input value={form.serialNumber || ''} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>
      <label><span>Maker</span><input value={form.manufacturer || ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></label>
      <div className="equipment-register-result"><span>Mã sẽ tự sinh sau khi lưu</span><strong>{form.equipmentType === 'PRODUCTION' ? 'CEV-PR-…' : 'CEV-ME-…'}</strong><small>Không cần nhớ số tiếp theo. Database tự khóa và cấp số.</small></div>
      <footer><button type="button" onClick={() => { setOpen(false); setForm(EMPTY) }}>Hủy</button><button className="equipment-register-save" disabled={saving || !form.equipmentName.trim() || !criticalityComplete}>{saving ? 'Đang tạo…' : 'Tạo thiết bị & sinh mã'}</button></footer>
    </form> : null}
  </section>
}
