import { useState } from 'react'
import type { FormEvent } from 'react'
import './EquipmentRegistration.css'
import { useAppRole } from './auth/AppRoleContext'
import { createEquipmentAuto, type EquipmentRegistrationInput } from './data/autoRegistration'

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
  criticality: '',
}

export function LiveEquipmentRegistrationPanel() {
  const role = useAppRole()
  const canCreate = ['MAINTENANCE', 'MANAGER', 'ADMIN'].includes(role)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EquipmentRegistrationInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canCreate || !form.equipmentName.trim()) return
    setSaving(true); setMessage(''); setError('')
    try {
      const result = await createEquipmentAuto({ ...form, equipmentName: form.equipmentName.trim() })
      setMessage(`Đã tạo ${result.equipmentId}. QR cũng tự dùng mã này.`)
      setForm(EMPTY)
      setOpen(false)
      window.dispatchEvent(new CustomEvent('equipment-created', { detail: result }))
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể đăng ký thiết bị')
    } finally { setSaving(false) }
  }

  if (!canCreate) return null
  return <section className="equipment-register-card">
    <div className="equipment-register-intro">
      <div><p className="eyebrow">Flow đăng ký · mã tự sinh</p><h2>Đăng ký thiết bị mới</h2><p>Chỉ điền thông tin thực tế. Hệ thống tự cấp <b>CEV-PR-xxx</b> hoặc <b>CEV-ME-xxx</b> và tự gắn QR.</p></div>
      <button type="button" className="equipment-register-toggle" onClick={() => setOpen((value) => !value)}>{open ? 'Đóng' : '+ Đăng ký'}</button>
    </div>
    {message ? <div className="equipment-register-message success">{message}</div> : null}
    {error ? <div className="equipment-register-message error">{error}</div> : null}
    {open ? <form className="equipment-register-form" onSubmit={submit}>
      <label><span>1. Đây là loại nào?</span><select value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value as EquipmentRegistrationInput['equipmentType'] })}><option value="PRODUCTION">Thiết bị sản xuất → CEV-PR</option><option value="MEASUREMENT">Thiết bị đo/kiểm → CEV-ME</option></select></label>
      <label className="wide"><span>2. Tên thiết bị *</span><input autoFocus value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })} placeholder="Ví dụ: Máy cuộn dây hình xuyến" required /></label>
      <label><span>3. Bộ phận sử dụng</span><input value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Coil / Press / WPC…" /></label>
      <label><span>4. Cấp độ thiết bị</span><select value={form.criticality || ''} onChange={(e) => setForm({ ...form, criticality: e.target.value as EquipmentRegistrationInput['criticality'] })}><option value="">Chưa xác định</option><option value="A">A — ảnh hưởng nặng</option><option value="B">B — ảnh hưởng vừa</option><option value="C">C — ảnh hưởng ít</option><option value="D">D — không ảnh hưởng</option></select></label>
      <label><span>Model</span><input value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
      <label><span>Serial Number</span><input value={form.serialNumber || ''} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>
      <label><span>Maker</span><input value={form.manufacturer || ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></label>
      <label><span>Khu vực / line</span><input value={form.currentLine || ''} onChange={(e) => setForm({ ...form, currentLine: e.target.value })} /></label>
      <div className="equipment-register-result"><span>Mã sẽ tự sinh sau khi lưu</span><strong>{form.equipmentType === 'PRODUCTION' ? 'CEV-PR-…' : 'CEV-ME-…'}</strong><small>Không cần nhớ số tiếp theo. Database tự khóa và cấp số.</small></div>
      <footer><button type="button" onClick={() => { setOpen(false); setForm(EMPTY) }}>Hủy</button><button className="equipment-register-save" disabled={saving || !form.equipmentName.trim()}>{saving ? 'Đang tạo…' : 'Tạo thiết bị & sinh mã'}</button></footer>
    </form> : null}
  </section>
}
