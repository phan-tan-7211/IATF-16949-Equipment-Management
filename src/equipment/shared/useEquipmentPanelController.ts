import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { canEditEquipment, useAppRole } from '../../auth/AppRoleContext'
import { deriveEquipmentCriticality } from '../../data/autoRegistration'
import { bulkUpdateEquipmentRows, type EquipmentRowPatch } from '../../data/equipmentBulkEdit'
import { buildEquipmentMasterSuggestions } from '../../data/equipmentMasterFields'
import { loadLiveEquipment, type LiveEquipment } from '../../data/liveEquipment'
import { checkEquipmentDeletion, deleteUnusedEquipment } from '../../data/equipmentDeletion'
import { deleteEquipmentPhotos } from '../../data/equipmentPhotoDelete'
import { getEquipmentPhotoCacheSnapshot, invalidateEquipmentPhotoCache, loadCachedEquipmentPhotoPreview, loadCachedEquipmentPhotoPreviews } from '../../data/equipmentPhotoCache'
import { updateEquipmentDetails, type EquipmentMasterEditInput } from '../../data/equipmentMasterEdit'
import { getEquipmentCacheSnapshot, uploadEquipmentPhoto } from '../../data/supabaseEquipment'

export const statusLabel: Record<string, string> = { RUNNING: 'Hoạt động', DOWN: 'Sự cố', MAINTENANCE: 'Bảo trì', STOPPED: 'Dừng', DISPOSED: 'Thanh lý', UNKNOWN: 'Chưa rõ' }
export const labelSizeLabel: Record<string, string> = { tiny: '15 × 25 mm', standard: '30 × 50 mm', large: '45 × 80 mm' }

export type PhotoInfo = { state: 'loading' | 'yes' | 'no' | 'error'; url: string }
export type PhotoHover = { url: string; name: string; x: number; y: number; size: number }
export type SortDirection = 'asc' | 'desc'
export type ColumnKey =
  | 'equipmentId' | 'equipmentName' | 'equipmentType' | 'equipmentCategory' | 'manufacturer' | 'distributor' | 'model' | 'serialNumber'
  | 'usingDepartment' | 'managingDepartment' | 'managementResponsiblePrimary' | 'managementResponsibleSecondary' | 'currentArea' | 'currentLine' | 'status' | 'defaultLabelSize'
  | 'technicalSpecification' | 'description' | 'accuracy' | 'criticality'
  | 'controlsProductQuality' | 'specialCharacteristicImpact' | 'stopsProduction' | 'hasBackup' | 'capacityImpact'
  | 'origin' | 'manufactureDate' | 'inServiceDate' | 'warrantyUntil' | 'warrantyContact'
  | 'note' | 'relatedDocuments' | 'qrCode' | 'active' | 'updatedAt'
export type ColumnGroup = 'Nhận diện'|'Quản lý'|'Kỹ thuật'|'Vòng đời'|'Tài liệu'|'Hệ thống'
export type ColumnDef = { key: ColumnKey; label: string; defaultVisible?: boolean; group: ColumnGroup }
export type ColumnFilters = Partial<Record<ColumnKey, string[]>>
export type InlineChanges = Record<string, EquipmentRowPatch>

const COLUMN_STORAGE_KEY = 'cev-equipment-visible-columns-v5'
export const COLUMNS: ColumnDef[] = [
  { key:'equipmentId',label:'Mã thiết bị',defaultVisible:true,group:'Nhận diện' },
  { key:'equipmentName',label:'Tên thiết bị',defaultVisible:true,group:'Nhận diện' },
  { key:'equipmentType',label:'Loại thiết bị',defaultVisible:true,group:'Nhận diện' },
  { key:'equipmentCategory',label:'Nhóm thiết bị',group:'Nhận diện' },
  { key:'managingDepartment',label:'Bộ phận quản lý',defaultVisible:true,group:'Quản lý' },
  { key:'managementResponsiblePrimary',label:'Người QL chính',defaultVisible:true,group:'Quản lý' },
  { key:'managementResponsibleSecondary',label:'Người QL phụ',defaultVisible:true,group:'Quản lý' },
  { key:'usingDepartment',label:'Bộ phận sử dụng',group:'Quản lý' },
  { key:'currentArea',label:'Khu vực',defaultVisible:true,group:'Quản lý' },
  { key:'currentLine',label:'Dây chuyền',defaultVisible:true,group:'Quản lý' },
  { key:'status',label:'Trạng thái',defaultVisible:true,group:'Quản lý' },
  { key:'defaultLabelSize',label:'Khổ tem mặc định',group:'Quản lý' },
  { key:'manufacturer',label:'Hãng / nhà sản xuất',group:'Nhận diện' },
  { key:'distributor',label:'Nhà phân phối',group:'Nhận diện' },
  { key:'model',label:'Mẫu máy',group:'Nhận diện' },
  { key:'serialNumber',label:'Số sê-ri',group:'Nhận diện' },
  { key:'technicalSpecification',label:'Thông số kỹ thuật',group:'Kỹ thuật' },
  { key:'description',label:'Mô tả / chức năng',group:'Kỹ thuật' },
  { key:'accuracy',label:'Độ chính xác',group:'Kỹ thuật' },
  { key:'criticality',label:'Cấp độ A/B/C/D',group:'Kỹ thuật' },
  { key:'controlsProductQuality',label:'Kiểm soát chất lượng',group:'Kỹ thuật' },
  { key:'specialCharacteristicImpact',label:'Ảnh hưởng đặc tính đặc biệt',group:'Kỹ thuật' },
  { key:'stopsProduction',label:'Mất máy gây dừng SX',group:'Kỹ thuật' },
  { key:'hasBackup',label:'Có thiết bị dự phòng',group:'Kỹ thuật' },
  { key:'capacityImpact',label:'Ảnh hưởng sản lượng / giao hàng',group:'Kỹ thuật' },
  { key:'origin',label:'Xuất xứ',group:'Vòng đời' },
  { key:'manufactureDate',label:'Ngày sản xuất',group:'Vòng đời' },
  { key:'inServiceDate',label:'Ngày đưa vào sử dụng',group:'Vòng đời' },
  { key:'warrantyUntil',label:'Bảo hành đến',group:'Vòng đời' },
  { key:'warrantyContact',label:'Liên hệ bảo hành',group:'Vòng đời' },
  { key:'note',label:'Ghi chú',group:'Tài liệu' },
  { key:'relatedDocuments',label:'Tài liệu liên quan',group:'Tài liệu' },
  { key:'qrCode',label:'Mã QR',group:'Hệ thống' },
  { key:'active',label:'Đang quản lý',group:'Hệ thống' },
  { key:'updatedAt',label:'Cập nhật gần nhất',group:'Hệ thống' },
]

export function booleanSelectValue(value: boolean | undefined) { return value === true ? 'YES' : value === false ? 'NO' : '' }
export function parseBooleanSelect(value: string) { return value === 'YES' ? true : value === 'NO' ? false : undefined }
function clipboardFileExtension(mimeType: string) { if (mimeType === 'image/png') return 'png'; if (mimeType === 'image/webp') return 'webp'; if (mimeType === 'image/gif') return 'gif'; return 'jpg' }
function clean(value: unknown) { return String(value ?? '').trim() }
function yesNo(value: boolean | undefined) { return value === true ? 'Có' : value === false ? 'Không' : 'Chưa trả lời' }
export function columnValue(row: LiveEquipment, key: ColumnKey) {
  if (key === 'equipmentType') return row.equipmentType === 'MEASUREMENT' ? 'Đo kiểm' : 'Sản xuất'
  if (key === 'status') return statusLabel[row.status] || row.status
  if (key === 'defaultLabelSize') return labelSizeLabel[row.defaultLabelSize || 'standard'] || '30 × 50 mm'
  if (key === 'controlsProductQuality') return yesNo(row.criticalityFacts?.controlsProductQuality)
  if (key === 'specialCharacteristicImpact') return yesNo(row.criticalityFacts?.specialCharacteristicImpact)
  if (key === 'stopsProduction') return yesNo(row.criticalityFacts?.stopsProduction)
  if (key === 'hasBackup') return yesNo(row.criticalityFacts?.hasBackup)
  if (key === 'capacityImpact') return yesNo(row.criticalityFacts?.capacityImpact)
  if (key === 'active') return row.active ? 'Đang quản lý' : 'Ngừng quản lý'
  if (key === 'updatedAt') return row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('vi-VN') : ''
  return clean(row[key as keyof LiveEquipment])
}
export function documentLinks(value: string) { return value.split(/[\n;,]+/).map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item)) }
function includesQuery(row: LiveEquipment, query: string) { if (!query) return true; return COLUMNS.map((col) => columnValue(row,col.key)).join(' ').toLocaleLowerCase().includes(query) }
export function defaultVisibleColumns() { return COLUMNS.filter((col) => col.defaultVisible).map((col) => col.key) }
function loadVisibleColumns(): ColumnKey[] { try { const parsed = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || '[]'); const valid = Array.isArray(parsed) ? parsed.filter((key): key is ColumnKey => COLUMNS.some((col) => col.key === key)) : []; return valid.length ? valid : defaultVisibleColumns() } catch { return defaultVisibleColumns() } }
function photoCacheInitialState(): Record<string, PhotoInfo> { const snapshot=getEquipmentPhotoCacheSnapshot(); return Object.fromEntries(Object.entries(snapshot).map(([id,preview])=>[id,{state:preview.exists?'yes':'no',url:preview.signedUrl} as PhotoInfo])) }
export function photoHoverPosition(clientX:number,clientY:number){
  const margin=12, gap=14
  const size=Math.min(360,Math.max(180,window.innerWidth-margin*2),Math.max(180,window.innerHeight-margin*2))
  let x=clientX+gap, y=clientY-size-gap
  if(x+size>window.innerWidth-margin)x=clientX-size-gap
  x=Math.max(margin,Math.min(x,window.innerWidth-size-margin))
  y=Math.max(margin,Math.min(y,window.innerHeight-size-margin))
  return {x,y,size}
}

export function patchKeyForColumn(key: ColumnKey): keyof EquipmentRowPatch | null {
  if (key === 'usingDepartment') return 'department'
  if (['equipmentId','equipmentType','criticality','qrCode','updatedAt'].includes(key)) return null
  return key as keyof EquipmentRowPatch
}
function editableRawValue(row: LiveEquipment, key: ColumnKey) {
  if (key === 'usingDepartment') return row.usingDepartment
  if (key === 'controlsProductQuality') return row.criticalityFacts?.controlsProductQuality
  if (key === 'specialCharacteristicImpact') return row.criticalityFacts?.specialCharacteristicImpact
  if (key === 'stopsProduction') return row.criticalityFacts?.stopsProduction
  if (key === 'hasBackup') return row.criticalityFacts?.hasBackup
  if (key === 'capacityImpact') return row.criticalityFacts?.capacityImpact
  return row[key as keyof LiveEquipment] as string | boolean | undefined
}
export function inlineValue(row: LiveEquipment, key: ColumnKey, changes: InlineChanges) {
  const patchKey=patchKeyForColumn(key)
  if (!patchKey) return undefined
  const patch=changes[row.equipmentId]
  if (patch && Object.prototype.hasOwnProperty.call(patch,patchKey)) return patch[patchKey] as string | boolean | undefined
  return editableRawValue(row,key)
}
function mergeInlinePatch(row: LiveEquipment, patch: EquipmentRowPatch): LiveEquipment {
  const next: LiveEquipment={...row}
  if (patch.equipmentName!==undefined) next.equipmentName=patch.equipmentName
  if (patch.equipmentCategory!==undefined) next.equipmentCategory=patch.equipmentCategory
  if (patch.manufacturer!==undefined) next.manufacturer=patch.manufacturer
  if (patch.distributor!==undefined) next.distributor=patch.distributor
  if (patch.model!==undefined) next.model=patch.model
  if (patch.serialNumber!==undefined) next.serialNumber=patch.serialNumber
  if (patch.department!==undefined) next.usingDepartment=patch.department
  if (patch.managingDepartment!==undefined) next.managingDepartment=patch.managingDepartment
  if (patch.managementResponsiblePrimary!==undefined) next.managementResponsiblePrimary=patch.managementResponsiblePrimary
  if (patch.managementResponsibleSecondary!==undefined) next.managementResponsibleSecondary=patch.managementResponsibleSecondary
  if (patch.currentArea!==undefined) next.currentArea=patch.currentArea
  if (patch.currentLine!==undefined) next.currentLine=patch.currentLine
  if (patch.status!==undefined) next.status=patch.status
  if (patch.defaultLabelSize!==undefined) next.defaultLabelSize=patch.defaultLabelSize
  if (patch.technicalSpecification!==undefined) next.technicalSpecification=patch.technicalSpecification
  if (patch.description!==undefined) next.description=patch.description
  if (patch.accuracy!==undefined) next.accuracy=patch.accuracy
  if (patch.origin!==undefined) next.origin=patch.origin
  if (patch.manufactureDate!==undefined) next.manufactureDate=patch.manufactureDate
  if (patch.inServiceDate!==undefined) next.inServiceDate=patch.inServiceDate
  if (patch.warrantyUntil!==undefined) next.warrantyUntil=patch.warrantyUntil
  if (patch.warrantyContact!==undefined) next.warrantyContact=patch.warrantyContact
  if (patch.note!==undefined) next.note=patch.note
  if (patch.relatedDocuments!==undefined) next.relatedDocuments=patch.relatedDocuments
  if (patch.active!==undefined) next.active=patch.active
  const facts={...(row.criticalityFacts||{})}
  if (patch.controlsProductQuality!==undefined) facts.controlsProductQuality=patch.controlsProductQuality
  if (patch.specialCharacteristicImpact!==undefined) facts.specialCharacteristicImpact=patch.specialCharacteristicImpact
  if (patch.stopsProduction!==undefined) facts.stopsProduction=patch.stopsProduction
  if (patch.hasBackup!==undefined) facts.hasBackup=patch.hasBackup
  if (patch.capacityImpact!==undefined) facts.capacityImpact=patch.capacityImpact
  next.criticalityFacts=facts
  const derived=deriveEquipmentCriticality(facts)
  if (derived) next.criticality=derived
  next.updatedAt=new Date().toISOString()
  return next
}
function toDraft(row: LiveEquipment): EquipmentMasterEditInput {
  const criticalityFacts = row.criticalityFacts
  return {
    equipmentId: row.equipmentId, equipmentType: row.equipmentType, equipmentName: row.equipmentName,
    equipmentCategory: row.equipmentCategory || '', manufacturer: row.manufacturer || '', distributor: row.distributor || '', model: row.model || '', serialNumber: row.serialNumber || '',
    department: row.usingDepartment || '', currentArea: row.currentArea || '', currentLine: row.currentLine || '', managingDepartment: row.managingDepartment || '',
    managementResponsiblePrimary: row.managementResponsiblePrimary || '', managementResponsibleSecondary: row.managementResponsibleSecondary || '',
    technicalSpecification: row.technicalSpecification || '', description: row.description || '', accuracy: row.accuracy || '', origin: row.origin || '',
    manufactureDate: row.manufactureDate || '', inServiceDate: row.inServiceDate || '', warrantyUntil: row.warrantyUntil || '', warrantyContact: row.warrantyContact || '',
    note: row.note || '', relatedDocuments: row.relatedDocuments || '', status: row.status || 'RUNNING',
    controlsProductQuality: criticalityFacts?.controlsProductQuality, specialCharacteristicImpact: criticalityFacts?.specialCharacteristicImpact,
    stopsProduction: criticalityFacts?.stopsProduction, hasBackup: criticalityFacts?.hasBackup, capacityImpact: criticalityFacts?.capacityImpact,
  }
}
function mergeDraftIntoRow(row: LiveEquipment, draft: EquipmentMasterEditInput, criticality: string): LiveEquipment {
  if (row.equipmentId !== draft.equipmentId.trim().toUpperCase()) return row
  return {
    ...row,
    equipmentName: draft.equipmentName.trim(), equipmentType: draft.equipmentType, equipmentCategory: draft.equipmentCategory.trim(),
    manufacturer: draft.manufacturer.trim(), distributor: draft.distributor?.trim() || '', model: draft.model.trim(), serialNumber: draft.serialNumber.trim(),
    currentArea: draft.currentArea.trim(), currentLine: draft.currentLine.trim(), managingDepartment: draft.managingDepartment.trim(),
    managementResponsiblePrimary: draft.managementResponsiblePrimary?.trim() || '', managementResponsibleSecondary: draft.managementResponsibleSecondary?.trim() || '',
    usingDepartment: draft.department.trim(), technicalSpecification: draft.technicalSpecification.trim(), description: draft.description.trim(),
    accuracy: draft.accuracy.trim(), origin: draft.origin.trim(), manufactureDate: draft.manufactureDate.trim(), inServiceDate: draft.inServiceDate.trim(),
    warrantyUntil: draft.warrantyUntil.trim(), warrantyContact: draft.warrantyContact.trim(), note: draft.note.trim(), relatedDocuments: draft.relatedDocuments.trim(),
    status: draft.status.trim() || 'RUNNING', criticality,
    criticalityFacts: { controlsProductQuality: draft.controlsProductQuality, specialCharacteristicImpact: draft.specialCharacteristicImpact, stopsProduction: draft.stopsProduction, hasBackup: draft.hasBackup, capacityImpact: draft.capacityImpact },
    updatedAt: new Date().toISOString(),
  }
}

export function useEquipmentPanelController() {
  const role = useAppRole(); const canBulkEdit = canEditEquipment(role)
  const [rows,setRows]=useState<LiveEquipment[]>(()=>getEquipmentCacheSnapshot())
  const [photos,setPhotos]=useState<Record<string,PhotoInfo>>(photoCacheInitialState)
  const [editing,setEditing]=useState<EquipmentMasterEditInput|null>(null)
  const [profileId,setProfileId]=useState('')
  const [loading,setLoading]=useState(()=>getEquipmentCacheSnapshot().length===0)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [uploadingId,setUploadingId]=useState('')
  const [deletingPhotoId,setDeletingPhotoId]=useState('')
  const [saving,setSaving]=useState(false)
  const [deleting,setDeleting]=useState(false)
  const [query,setQuery]=useState('')
  const [sortKey,setSortKey]=useState<ColumnKey>('equipmentId')
  const [sortDirection,setSortDirection]=useState<SortDirection>('asc')
  const [bulkMode,setBulkMode]=useState(false)
  const [bulkSaving,setBulkSaving]=useState(false)
  const [inlineChanges,setInlineChanges]=useState<InlineChanges>({})
  const [visibleColumns,setVisibleColumns]=useState<ColumnKey[]>(loadVisibleColumns)
  const [columnPickerOpen,setColumnPickerOpen]=useState(false)
  const [filterColumn,setFilterColumn]=useState<ColumnKey|null>(null)
  const [filterSearch,setFilterSearch]=useState('')
  const [columnFilters,setColumnFilters]=useState<ColumnFilters>({})
  const [photoHover,setPhotoHover]=useState<PhotoHover|null>(null)
  const columnPickerRef=useRef<HTMLDivElement|null>(null)

  const masterSuggestions=useMemo(()=>buildEquipmentMasterSuggestions(rows.map((row)=>({...row,department:row.usingDepartment}))),[rows])
  useEffect(()=>{ localStorage.setItem(COLUMN_STORAGE_KEY,JSON.stringify(visibleColumns)) },[visibleColumns])

  async function refreshOnePhoto(equipmentId:string,force=false){ setPhotos((current)=>({...current,[equipmentId]:{state:'loading',url:current[equipmentId]?.url||''}})); try{const preview=await loadCachedEquipmentPhotoPreview(equipmentId,force);setPhotos((current)=>({...current,[equipmentId]:{state:preview.exists?'yes':'no',url:preview.signedUrl}}));return preview.exists}catch{setPhotos((current)=>({...current,[equipmentId]:{state:'error',url:current[equipmentId]?.url||''}}));return false} }
  async function refreshPhotoStates(result:LiveEquipment[]){ setPhotos((current)=>Object.fromEntries(result.map((row)=>[row.equipmentId,current[row.equipmentId]||{state:'loading',url:''} as PhotoInfo]))); try{const previews=await loadCachedEquipmentPhotoPreviews(result.map((row)=>row.equipmentId));setPhotos((current)=>Object.fromEntries(result.map((row)=>{const preview=previews[row.equipmentId];return [row.equipmentId,preview?{state:preview.exists?'yes':'no',url:preview.signedUrl||''} as PhotoInfo:current[row.equipmentId]||{state:'loading',url:''} as PhotoInfo]})))}catch{setPhotos((current)=>Object.fromEntries(result.map((row)=>[row.equipmentId,current[row.equipmentId]||{state:'error',url:''} as PhotoInfo])))} }
  async function reloadEquipment(force=false){const block=force||rows.length===0;if(block)setLoading(true);try{const result=await loadLiveEquipment({force});setRows(result);setError('');void refreshPhotoStates(result)}catch(cause){setError(cause instanceof Error?cause.message:'Không thể tải danh mục thiết bị')}finally{if(block)setLoading(false)}}
  useEffect(()=>{const snapshot=getEquipmentCacheSnapshot();if(snapshot.length){setRows(snapshot);setLoading(false);void refreshPhotoStates(snapshot);void loadLiveEquipment({force:true}).then((result)=>{setRows(result);setError('');void refreshPhotoStates(result)}).catch(()=>undefined)}else{setLoading(true);void loadLiveEquipment({force:true}).then((result)=>{setRows(result);setError('');void refreshPhotoStates(result)}).catch((cause)=>setError(cause instanceof Error?cause.message:'Không thể tải danh mục thiết bị')).finally(()=>setLoading(false))}},[])
  useEffect(()=>{if(!editing)return;const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setEditing(null)};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[editing])
  useEffect(()=>{
    const onPointerDown=(event:PointerEvent)=>{
      const target=event.target
      if(!(target instanceof Node))return
      if(columnPickerRef.current&&!columnPickerRef.current.contains(target))setColumnPickerOpen(false)
      if(!(target instanceof Element)||!target.closest('.equipment-filter-popover,.equipment-filter-button')){setFilterColumn(null);setFilterSearch('')}
    }
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){setColumnPickerOpen(false);setFilterColumn(null);setFilterSearch('');setPhotoHover(null)}}
    document.addEventListener('pointerdown',onPointerDown,true)
    document.addEventListener('keydown',onKeyDown,true)
    return()=>{document.removeEventListener('pointerdown',onPointerDown,true);document.removeEventListener('keydown',onKeyDown,true)}
  },[])

  const editCriticality=editing?deriveEquipmentCriticality(editing):''
  const activeFilterCount=Object.values(columnFilters).filter((value)=>value?.length).length
  const filteredRows=useMemo(()=>rows.filter((row)=>{if(!includesQuery(row,query.trim().toLocaleLowerCase()))return false;for(const [key,values] of Object.entries(columnFilters) as Array<[ColumnKey,string[]|undefined]>){if(values?.length&&!values.includes(columnValue(row,key)||'—'))return false}return true}),[rows,query,columnFilters])
  const sortedRows=useMemo(()=>[...filteredRows].sort((a,b)=>{const result=columnValue(a,sortKey).localeCompare(columnValue(b,sortKey),'vi',{numeric:true,sensitivity:'base'});return sortDirection==='asc'?result:-result}),[filteredRows,sortKey,sortDirection])
  const productionCount=rows.filter((row)=>row.equipmentType==='PRODUCTION').length
  const measurementCount=rows.filter((row)=>row.equipmentType==='MEASUREMENT').length
  const profileEquipment=profileId?rows.find((row)=>row.equipmentId===profileId)||null:null
  const dirtyCount=Object.keys(inlineChanges).length

  function openPhotoHover(url:string,name:string,clientX:number,clientY:number){if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;setPhotoHover({url,name,...photoHoverPosition(clientX,clientY)})}
  function openEdit(row:LiveEquipment){setProfileId('');setEditing(toDraft(row))}
  function toggleSort(key:ColumnKey){if(sortKey===key)setSortDirection((value)=>value==='asc'?'desc':'asc');else{setSortKey(key);setSortDirection('asc')}}
  function toggleColumn(key:ColumnKey){setVisibleColumns((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key])}
  function filterOptions(key:ColumnKey){return Array.from(new Set(rows.map((row)=>columnValue(row,key)||'—'))).sort((a,b)=>a.localeCompare(b,'vi',{numeric:true,sensitivity:'base'}))}
  function toggleFilterValue(key:ColumnKey,value:string){setColumnFilters((current)=>{const selected=current[key]||[];const next=selected.includes(value)?selected.filter((item)=>item!==value):[...selected,value];const result={...current,[key]:next};if(!next.length)delete result[key];return result})}
  function clearFilter(key:ColumnKey){setColumnFilters((current)=>{const next={...current};delete next[key];return next})}
  function setInlineCell(equipment:LiveEquipment,key:ColumnKey,value:string|boolean){const patchKey=patchKeyForColumn(key);if(!patchKey)return;setInlineChanges((current)=>({...current,[equipment.equipmentId]:{...(current[equipment.equipmentId]||{}),[patchKey]:value}}))}
  function exitBulkMode(){if(dirtyCount&&!window.confirm(`Bỏ ${dirtyCount} dòng chưa lưu?`))return;setInlineChanges({});setBulkMode(false)}
  async function saveInlineChanges(){const changes=Object.entries(inlineChanges).map(([equipmentId,patch])=>({equipmentId,patch}));if(!changes.length)return;const before=rows;setBulkSaving(true);setError('');setMessage('');setRows((current)=>current.map((row)=>inlineChanges[row.equipmentId]?mergeInlinePatch(row,inlineChanges[row.equipmentId]):row));try{const result=await bulkUpdateEquipmentRows(changes);setInlineChanges({});setMessage(`Đã lưu ${result.updatedCount} dòng trực tiếp trên bảng.`)}catch(cause){setRows(before);setError(cause instanceof Error?cause.message:'Không thể lưu thay đổi trên bảng.')}finally{setBulkSaving(false)}}
  async function handleSave(){if(!editing)return;if(!editing.equipmentName.trim()){setMessage('Tên thiết bị không được để trống.');return}if(!editing.managementResponsiblePrimary?.trim()){setMessage('Người phụ trách quản lý chính không được để trống.');return}if(!editCriticality){setMessage('Trả lời đủ 5 câu về mức độ quan trọng trước khi lưu.');return}setSaving(true);setMessage('');const draft=editing;try{const result=await updateEquipmentDetails(draft);setRows((current)=>current.map((row)=>mergeDraftIntoRow(row,draft,result.criticality)));setMessage(`Đã lưu ${result.equipmentId} · Cấp ${result.criticality}`);setEditing(null)}catch(cause){setMessage(cause instanceof Error?cause.message:'Không thể lưu thay đổi')}finally{setSaving(false)}}
  async function handleDelete(){if(!editing||deleting||saving)return;const equipmentId=editing.equipmentId.trim().toUpperCase();setDeleting(true);setMessage('');try{const check=await checkEquipmentDeletion(equipmentId);if(!check.exists){setMessage(`${equipmentId} không còn tồn tại.`);setEditing(null);await reloadEquipment(true);return}if(!check.canDelete){setMessage(`Không thể xóa ${equipmentId} vì đã có dữ liệu liên quan. ${check.blockers.map((item)=>`${item.label}: ${item.count}`).join(' · ')}`);return}if(!window.confirm(`Xóa ${equipmentId} - ${editing.equipmentName}?\n\nThiết bị chưa có dữ liệu nghiệp vụ liên quan nên có thể xóa. Hệ thống cũng sẽ xóa toàn bộ ảnh của mã này. Hành động không thể hoàn tác.`))return;const result=await deleteUnusedEquipment(equipmentId);invalidateEquipmentPhotoCache(equipmentId);setRows((current)=>current.filter((row)=>row.equipmentId!==equipmentId));setPhotos((current)=>{const next={...current};delete next[equipmentId];return next});setProfileId('');setEditing(null);setMessage(`Đã xóa ${equipmentId}${Number(result.removedPhotos||0)>0?` và ${result.removedPhotos} ảnh`:''}.`)}catch(cause){setMessage(cause instanceof Error?cause.message:'Không thể xóa thiết bị')}finally{setDeleting(false)}}
  async function confirmPhotoReplacement(equipmentId:string){const current=photos[equipmentId];if(current?.state==='yes')return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`);if(!current||current.state==='loading'||current.state==='error'){const exists=await refreshOnePhoto(equipmentId);if(exists)return window.confirm(`Thiết bị ${equipmentId} đã có ảnh. Thay thế ảnh hiện tại?`)}return true}
  async function uploadAndRefresh(equipmentId:string,file:File){setUploadingId(equipmentId);setMessage('');try{await uploadEquipmentPhoto(equipmentId,file);invalidateEquipmentPhotoCache(equipmentId);await refreshOnePhoto(equipmentId,true);setMessage(`Đã cập nhật ảnh ${equipmentId}`)}catch(cause){setMessage(cause instanceof Error?`Không thể tải ảnh: ${cause.message}`:'Không thể tải ảnh')}finally{setUploadingId('')}}
  async function handlePhotoUpload(equipmentId:string,file:File|undefined){if(!file||!await confirmPhotoReplacement(equipmentId))return;await uploadAndRefresh(equipmentId,file)}
  async function handlePhotoDelete(equipmentId:string){if(!photos[equipmentId]?.url||uploadingId||deletingPhotoId)return;if(!window.confirm(`Xóa ảnh hiện tại của ${equipmentId}?\n\nChỉ ảnh sẽ bị xóa. Dữ liệu thiết bị và lịch sử không thay đổi.`))return;setDeletingPhotoId(equipmentId);setMessage('');try{const removed=await deleteEquipmentPhotos(equipmentId);invalidateEquipmentPhotoCache(equipmentId);setPhotos((current)=>({...current,[equipmentId]:{state:'no',url:''}}));setMessage(removed>0?`Đã xóa ảnh ${equipmentId}.`:`${equipmentId} không có ảnh để xóa.`)}catch(cause){setMessage(cause instanceof Error?cause.message:'Không thể xóa ảnh')}finally{setDeletingPhotoId('')}}
  async function handleClipboardUpload(equipmentId:string){if(!navigator.clipboard?.read){setMessage('Trình duyệt không hỗ trợ đọc ảnh từ bộ nhớ tạm.');return}try{for(const item of await navigator.clipboard.read()){const imageType=item.types.find((type)=>type.startsWith('image/'));if(!imageType)continue;if(!await confirmPhotoReplacement(equipmentId))return;const blob=await item.getType(imageType);await uploadAndRefresh(equipmentId,new File([blob],`clipboard.${clipboardFileExtension(imageType)}`,{type:imageType}));return}setMessage('Bộ nhớ tạm không có ảnh.')}catch(cause){setMessage(cause instanceof Error?`Không thể đọc ảnh từ bộ nhớ tạm: ${cause.message}`:'Không thể đọc ảnh từ bộ nhớ tạm')}}
  async function handleEmptyPhotoCellPaste(equipmentId:string,event:ClipboardEvent<HTMLElement>){const current=photos[equipmentId];if(current?.state!=='no'||uploadingId)return;const imageItem=Array.from(event.clipboardData.items).find((item)=>item.type.startsWith('image/'));if(!imageItem){setMessage('Bộ nhớ tạm không có ảnh.');return}event.preventDefault();const file=imageItem.getAsFile();if(!file){setMessage('Không đọc được ảnh từ bộ nhớ tạm.');return}await uploadAndRefresh(equipmentId,file)}

  return {
    rows, photos, editing, setEditing, profileId, setProfileId, loading, error, message, uploadingId, deletingPhotoId, saving, deleting,
    query, setQuery, sortKey, sortDirection, bulkMode, setBulkMode, bulkSaving, inlineChanges, setInlineChanges,
    visibleColumns, setVisibleColumns, columnPickerOpen, setColumnPickerOpen, filterColumn, setFilterColumn, filterSearch, setFilterSearch,
    columnFilters, setColumnFilters, photoHover, setPhotoHover, columnPickerRef, masterSuggestions, editCriticality, activeFilterCount,
    sortedRows, productionCount, measurementCount, profileEquipment, dirtyCount, canBulkEdit,
    reloadEquipment, openPhotoHover, openEdit, toggleSort, toggleColumn, filterOptions, toggleFilterValue, clearFilter, setInlineCell,
    exitBulkMode, saveInlineChanges, handleSave, handleDelete, handlePhotoUpload, handlePhotoDelete, handleClipboardUpload, handleEmptyPhotoCellPaste,
  }
}

export type EquipmentPanelController = ReturnType<typeof useEquipmentPanelController>
