import { SmartAutocomplete } from './components/SmartAutocomplete'
import type { EquipmentMasterEditInput } from './data/equipmentMasterEdit'
import { canonicalizeMasterValue, type EquipmentMasterSuggestionKey, type EquipmentMasterSuggestions } from './data/equipmentMasterFields'

type Props = {
  value: EquipmentMasterEditInput
  suggestions: EquipmentMasterSuggestions
  onChange: (next: EquipmentMasterEditInput) => void
}

export function EquipmentMasterEditFields({ value, suggestions, onChange }: Props) {
  function setField<K extends keyof EquipmentMasterEditInput>(key: K, nextValue: EquipmentMasterEditInput[K]) {
    onChange({ ...value, [key]: nextValue })
  }
  function textField(key: keyof EquipmentMasterEditInput, label: string, suggestionKey?: EquipmentMasterSuggestionKey, wide = false, required = false) {
    return <label className={wide ? 'equipment-edit-wide' : undefined}><span>{label}</span>{suggestionKey ? <SmartAutocomplete required={required} value={String(value[key] || '')} options={suggestions[suggestionKey]} onChange={(nextValue) => setField(key, nextValue as never)} onBlur={() => setField(key, canonicalizeMasterValue(String(value[key] || ''), suggestions[suggestionKey]) as never)} /> : <input required={required} value={String(value[key] || '')} onChange={(event) => setField(key, event.target.value as never)} />}</label>
  }

  return <div className="equipment-edit-grid">
    <label><span>Mã thiết bị</span><input value={value.equipmentId} readOnly /></label>
    <label><span>Loại thiết bị</span><input value={value.equipmentType === 'MEASUREMENT' ? 'Thiết bị đo kiểm' : 'Thiết bị sản xuất'} readOnly /></label>
    {textField('equipmentName','Tên thiết bị','equipmentName',true)}
    {textField('equipmentCategory','Nhóm thiết bị','equipmentCategory')}
    {textField('manufacturer','Hãng / nhà sản xuất','manufacturer')}
    {textField('model','Mẫu máy','model')}
    {textField('serialNumber','Số sê-ri')}
    {textField('department','Bộ phận sử dụng','department')}
    {textField('managingDepartment','Bộ phận quản lý','managingDepartment')}
    {textField('managementResponsiblePrimary','Người phụ trách quản lý · Chính *','managementResponsiblePrimary',false,true)}
    {textField('managementResponsibleSecondary','Người phụ trách quản lý · Phụ','managementResponsibleSecondary')}
    {textField('currentArea','Khu vực','currentArea')}
    {textField('currentLine','Dây chuyền','currentLine')}
    {textField('origin','Xuất xứ','origin')}
    {textField('accuracy','Độ chính xác','accuracy')}
    <label><span>Ngày sản xuất</span><input type="date" value={value.manufactureDate} onChange={(event) => setField('manufactureDate', event.target.value)} /></label>
    <label><span>Ngày đưa vào sử dụng</span><input type="date" value={value.inServiceDate} onChange={(event) => setField('inServiceDate', event.target.value)} /></label>
    <label><span>Bảo hành đến ngày</span><input type="date" value={value.warrantyUntil} onChange={(event) => setField('warrantyUntil', event.target.value)} /></label>
    {textField('warrantyContact','Liên hệ bảo hành','warrantyContact')}
    {textField('technicalSpecification','Thông số kỹ thuật','technicalSpecification',true)}
    {textField('description','Mô tả / chức năng chính','description',true)}
    {textField('note','Ghi chú','note',true)}
    {textField('relatedDocuments','Tài liệu liên quan','relatedDocuments',true)}
    <label><span>Trạng thái</span><select value={value.status} onChange={(event) => setField('status', event.target.value)}><option value="RUNNING">Hoạt động</option><option value="DOWN">Sự cố</option><option value="MAINTENANCE">Bảo trì</option><option value="STOPPED">Dừng</option><option value="DISPOSED">Thanh lý</option></select></label>
  </div>
}
