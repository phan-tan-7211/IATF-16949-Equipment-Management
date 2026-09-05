import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { canEditEquipment, useAppRole } from '../../auth/AppRoleContext'
import { deriveEquipmentCriticality } from '../../data/autoRegistration'
import { bulkUpdateEquipmentRows } from '../../data/equipmentBulkEdit'
import { buildEquipmentMasterSuggestions } from '../../data/equipmentMasterFields'
import { loadLiveEquipment, type LiveEquipment } from '../../data/liveEquipment'
import { checkEquipmentDeletion, deleteUnusedEquipment } from '../../data/equipmentDeletion'
import { deleteEquipmentPhotos } from '../../data/equipmentPhotoDelete'
import { getEquipmentPhotoCacheSnapshot, invalidateEquipmentPhotoCache, loadCachedEquipmentPhotoPreview, loadCachedEquipmentPhotoPreviews } from '../../data/equipmentPhotoCache'
import { updateEquipmentDetails, type EquipmentMasterEditInput } from '../../data/equipmentMasterEdit'
import { getEquipmentCacheSnapshot, uploadEquipmentPhoto } from '../../data/supabaseEquipment'
import {
  COLUMN_STORAGE_KEY,
  COLUMNS,
  columnValue,
  includesQuery,
  loadVisibleColumns,
  patchKeyForColumn,
  photoHoverPosition,
  type ColumnFilters,
  type ColumnKey,
  type InlineChanges,
  type PhotoHover,
  type PhotoInfo,
  type SortDirection,
} from './equipmentColumns'
import { mergeDraftIntoRow, mergeInlinePatch, toDraft } from './equipmentRowMappers'

export {
  COLUMNS,
  booleanSelectValue,
  columnValue,
  defaultVisibleColumns,
  documentLinks,
  inlineValue,
  parseBooleanSelect,
  patchKeyForColumn,
  photoHoverPosition,
  statusLabel,
} from './equipmentColumns'
export type { ColumnDef, ColumnFilters, ColumnKey, InlineChanges, PhotoHover, PhotoInfo, SortDirection } from './equipmentColumns'

function clipboardFileExtension(mimeType: string) { if (mimeType === 'image/png') return 'png'; if (mimeType === 'image/webp') return 'webp'; if (mimeType === 'image/gif') return 'gif'; return 'jpg' }
function photoCacheInitialState(): Record<string, PhotoInfo> { const snapshot=getEquipmentPhotoCacheSnapshot(); return Object.fromEntries(Object.entries(snapshot).map(([id,preview])=>[id,{state:preview.exists?'yes':'no',url:preview.signedUrl} as PhotoInfo])) }

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
